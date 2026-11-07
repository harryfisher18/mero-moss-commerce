import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CheckoutDetails } from "@/domain/commerce/order";
import { DRILL_FAILURE_MESSAGE } from "@/domain/events/outbox";
import { AutomationService } from "@/server/automation-service";
import { CartService } from "@/server/cart-service";
import { type Database, openDatabase } from "@/server/db/database";
import { seedDatabase } from "@/server/db/seed";
import { OrderService } from "@/server/order-service";

const MAT_LARGE = "var_mm-ws-fdm-chr-l"; // $58.00, stock 9
const T0 = Date.parse("2026-11-08T12:00:00.000Z");

const details: CheckoutDetails = {
  email: "avery@example.com",
  fullName: "Avery Stone",
  address1: "12 Elm Street",
  address2: "",
  city: "Portland",
  region: "OR",
  postalCode: "97205",
  acknowledgeSimulated: "yes",
};

let db: Database;
let clock: number;
let counter: number;
let carts: CartService;
let orders: OrderService;
let automation: AutomationService;

const nowIso = () => new Date(clock).toISOString();
const id = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
const count = (sql: string, ...params: string[]) => Number(db.prepare(sql).get(...params)?.n);
const eventCount = () => count("SELECT COUNT(*) AS n FROM outbox_events");
const previewCount = () => count("SELECT COUNT(*) AS n FROM notification_previews");
const tagCount = () => count("SELECT COUNT(*) AS n FROM order_tags");

function placeOrder(quantity = 1) {
  const { cartId } = carts.add(undefined, MAT_LARGE, quantity);
  const result = orders.placeOrder(cartId, details);
  if (!result.ok) throw new Error(`Order failed: ${result.reason}`);
  return result.order;
}

function onlyEventFor(orderId: string) {
  const [event, ...rest] = automation.forOrder(orderId).events;
  if (!event || rest.length > 0) throw new Error("Expected exactly one event for the order");
  return event;
}

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
  clock = T0;
  counter = 0;
  carts = new CartService(db, nowIso, id);
  orders = new OrderService(db, nowIso, id);
  automation = new AutomationService(db, () => new Date(clock), id);
});

afterEach(() => db.close());

describe("transactional outbox", () => {
  it("writes an order.created event in the same transaction as the order", () => {
    const order = placeOrder();
    const event = onlyEventFor(order.id);
    expect(event).toMatchObject({
      type: "order.created",
      subject: order.orderNumber,
      status: "pending",
      attempts: 0,
      maxAttempts: 5,
      nextAttemptAt: nowIso(),
    });
    expect(event.payload).toMatchObject({ orderId: order.id, orderNumber: "MM-100001" });
  });

  it("writes no event when the order is rejected", () => {
    const { cartId } = carts.add(undefined, MAT_LARGE, 2);
    db.prepare("UPDATE variants SET inventory_quantity = 1 WHERE id = ?").run(MAT_LARGE);
    expect(orders.placeOrder(cartId, details).ok).toBe(false);
    expect(eventCount()).toBe(0);
  });

  it("rolls the order back when the event cannot be written", () => {
    const { cartId } = carts.add(undefined, MAT_LARGE, 2); // ids 1 (cart)
    // The order takes ids 2 and 3; occupy id 4 so the event insert hits a primary-key clash.
    db.prepare(
      `INSERT INTO outbox_events (id, type, aggregate_id, subject, payload, max_attempts, next_attempt_at, created_at)
       VALUES (?, 'automation.drill', 'drill', 'x', '{}', 5, ?, ?)`,
    ).run("00000000-0000-4000-8000-000000000004", nowIso(), nowIso());
    expect(() => orders.placeOrder(cartId, details)).toThrow();
    expect(count("SELECT COUNT(*) AS n FROM orders")).toBe(0);
    expect(count("SELECT inventory_quantity AS n FROM variants WHERE id = ?", MAT_LARGE)).toBe(9);
    expect(eventCount()).toBe(1);
  });
});

describe("worker", () => {
  it("routes the order, records previews and marks the event succeeded", () => {
    const order = placeOrder();
    expect(automation.runDue()).toEqual({ processed: 1, succeeded: 1, retrying: 0, dead: 0 });

    const detail = automation.detail(onlyEventFor(order.id).id);
    expect(detail?.event).toMatchObject({ status: "succeeded", attempts: 1, lastError: null });
    expect(detail?.tags.map((t) => t.tag)).toEqual(["route:west"]);
    expect(detail?.previews.map((p) => [p.kind, p.recipient])).toEqual([
      ["customer_confirmation", "avery@example.com"],
    ]);
    expect(detail?.attempts.map((a) => [a.trigger, a.outcome])).toEqual([["worker", "succeeded"]]);
    expect(db.prepare("SELECT DISTINCT delivery FROM notification_previews").all()).toEqual([
      { delivery: "preview_only" },
    ]);
  });

  it("tags bulk orders for review and previews an internal review request", () => {
    const order = placeOrder(5);
    automation.runDue();
    const detail = automation.detail(onlyEventFor(order.id).id);
    expect(detail?.tags.map((t) => t.tag)).toEqual(["review:bulk-quantity", "route:west"]);
    expect(detail?.previews.map((p) => p.kind)).toEqual([
      "customer_confirmation",
      "merchant_review",
    ]);
  });

  it("is idempotent: replays and second workers never duplicate effects", () => {
    const order = placeOrder(5);
    const eventId = onlyEventFor(order.id).id;
    automation.runDue();
    const effects = { previews: previewCount(), tags: tagCount() };
    expect(effects).toEqual({ previews: 2, tags: 2 });

    const replay = automation.replay(eventId);
    expect(replay).toMatchObject({ ok: true, outcome: "duplicate", effects: 0, attempts: 1 });
    expect(automation.replay(eventId)).toMatchObject({ ok: true, outcome: "duplicate" });
    expect({ previews: previewCount(), tags: tagCount() }).toEqual(effects);

    // A second worker sharing the database finds nothing due.
    const secondWorker = new AutomationService(db, () => new Date(clock), id);
    expect(secondWorker.runDue().processed).toBe(0);
    expect(automation.detail(eventId)?.attempts.map((a) => a.outcome)).toEqual([
      "succeeded",
      "duplicate",
      "duplicate",
    ]);
    expect(automation.detail(eventId)?.event.attempts).toBe(1);
  });

  it("only allows replay of succeeded order events and retry of unfinished ones", () => {
    const order = placeOrder();
    const eventId = onlyEventFor(order.id).id;
    expect(automation.replay(eventId)).toEqual({ ok: false, reason: "not_allowed" });
    automation.runDue();
    expect(automation.retryNow(eventId)).toEqual({ ok: false, reason: "not_allowed" });
    expect(automation.replay("missing")).toEqual({ ok: false, reason: "not_found" });

    const drill = automation.startDrill("recovers");
    expect(automation.replay(drill)).toEqual({ ok: false, reason: "not_allowed" });
  });
});

describe("failures, backoff and dead letter", () => {
  it("retries with bounded exponential backoff, then dead-letters", () => {
    const eventId = automation.startDrill("always_fails");
    const nextAttempt = () => automation.detail(eventId)?.event.nextAttemptAt;
    expect(nextAttempt()).toBe("2026-11-08T12:00:10.000Z");

    const delays = [10_000, 20_000, 40_000, 80_000];
    for (const [index, delay] of delays.entries()) {
      clock += delay - 1;
      expect(automation.runDue().processed).toBe(0); // not due a millisecond early
      clock += 1;
      const summary = automation.runDue();
      expect(summary.processed).toBe(1);
      if (index < delays.length - 1) {
        expect(summary.retrying).toBe(1);
        expect(nextAttempt()).toBe(new Date(clock + (delays[index + 1] ?? 0)).toISOString());
      } else {
        expect(summary.dead).toBe(1);
      }
    }

    const detail = automation.detail(eventId);
    expect(detail?.event).toMatchObject({
      status: "dead",
      attempts: 5,
      lastError: DRILL_FAILURE_MESSAGE,
    });
    expect(detail?.attempts.map((a) => a.outcome)).toEqual([
      "failed",
      "failed",
      "failed",
      "failed",
      "dead",
    ]);
    clock += 3_600_000;
    expect(automation.runDue().processed).toBe(0);
    // A manual retry from the dead letter is a single try and stays dead on failure.
    expect(automation.retryNow(eventId)).toMatchObject({ ok: true, outcome: "dead", attempts: 6 });
  });

  it("recovers when a retried attempt succeeds", () => {
    const eventId = automation.startDrill("recovers");
    expect(automation.retryNow(eventId)).toMatchObject({ outcome: "failed", delayMs: 20_000 });
    expect(automation.retryNow(eventId)).toMatchObject({ outcome: "succeeded", attempts: 3 });
    expect(automation.detail(eventId)?.event).toMatchObject({
      status: "succeeded",
      lastError: null,
    });
  });

  it("rolls back partial effects of a failed attempt and applies them once on retry", () => {
    const order = placeOrder();
    const eventId = onlyEventFor(order.id).id;
    // Tags are written before previews; make the preview write fail.
    db.exec(`CREATE TRIGGER preview_outage BEFORE INSERT ON notification_previews
             BEGIN SELECT RAISE(ABORT, 'preview store unavailable'); END;`);

    expect(automation.runDue()).toMatchObject({ processed: 1, retrying: 1 });
    expect(tagCount()).toBe(0);
    expect(automation.detail(eventId)?.event).toMatchObject({
      status: "pending",
      attempts: 1,
      lastError: "preview store unavailable",
    });

    db.exec("DROP TRIGGER preview_outage");
    clock += 10_000;
    expect(automation.runDue()).toMatchObject({ processed: 1, succeeded: 1 });
    expect({ tags: tagCount(), previews: previewCount() }).toEqual({ tags: 1, previews: 1 });
    expect(automation.detail(eventId)?.event).toMatchObject({ status: "succeeded", attempts: 2 });
  });

  it("dead-letters an invalid payload immediately instead of retrying", () => {
    db.prepare(
      `INSERT INTO outbox_events (id, type, aggregate_id, subject, payload, max_attempts, next_attempt_at, created_at)
       VALUES ('bad-event', 'order.created', 'nope', 'MM-999999', '{"orderId":"nope"}', 5, ?, ?)`,
    ).run(nowIso(), nowIso());
    expect(automation.runDue()).toMatchObject({ processed: 1, dead: 1 });
    expect(automation.detail("bad-event")?.event).toMatchObject({ status: "dead", attempts: 1 });
    expect(automation.detail("bad-event")?.event.lastError).toMatch(/^Payload failed validation/);
  });

  it("counts events by display status", () => {
    placeOrder();
    automation.startDrill("always_fails");
    expect(automation.counts()).toEqual({ all: 2, queued: 1, retrying: 1, succeeded: 0, dead: 0 });
    expect(automation.list("retrying").map((e) => e.type)).toEqual(["automation.drill"]);
  });
});
