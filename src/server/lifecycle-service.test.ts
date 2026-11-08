import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CheckoutDetails } from "@/domain/commerce/order";
import { decideJourney, renderAbandonedCart, renderWelcome } from "@/domain/lifecycle/journeys";
import { AutomationService } from "@/server/automation-service";
import { CartService } from "@/server/cart-service";
import { type Database, openDatabase } from "@/server/db/database";
import { seedDatabase } from "@/server/db/seed";
import type { MarketingProvider, OutgoingMessage } from "@/server/integrations/marketing-provider";
import { LifecycleService } from "@/server/lifecycle-service";
import { OrderService } from "@/server/order-service";

const MAT = "var_mm-ws-fdm-chr-l"; // $58.00, stock 9
const T0 = Date.parse("2026-11-08T12:00:00.000Z");
const HOUR = 3_600_000;

const details = (email: string, marketingConsent?: "yes"): CheckoutDetails => ({
  email,
  fullName: "Avery Stone",
  address1: "12 Elm Street",
  address2: "",
  city: "Portland",
  region: "OR",
  postalCode: "97205",
  acknowledgeSimulated: "yes",
  marketingConsent,
});

class CountingProvider implements MarketingProvider {
  sent: OutgoingMessage[] = [];
  deliver(message: OutgoingMessage) {
    this.sent.push(message);
    return "preview_only" as const;
  }
}

let db: Database;
let clock: number;
let provider: CountingProvider;
let carts: CartService;
let orders: OrderService;
let lifecycle: LifecycleService;
let automation: AutomationService;

const nowIso = () => new Date(clock).toISOString();
const rows = () =>
  db
    .prepare("SELECT journey, email, status, reference FROM lifecycle_messages ORDER BY id")
    .all()
    .map((row) => ({ ...row }));
const journeys = () => rows().map((row) => [row.journey, row.status]);

function order(email: string, consent?: "yes") {
  const { cartId } = carts.add(undefined, MAT, 1);
  const result = orders.placeOrder(cartId, details(email, consent));
  if (!result.ok) throw new Error(result.reason);
  return result.order;
}

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
  clock = T0;
  provider = new CountingProvider();
  carts = new CartService(db, nowIso);
  orders = new OrderService(db, nowIso);
  lifecycle = new LifecycleService(db, provider, () => new Date(clock));
  automation = new AutomationService(db, () => new Date(clock), undefined, undefined, lifecycle);
});

afterEach(() => db.close());

describe("consent gate", () => {
  it("does not render anything without consent", () => {
    let rendered = false;
    expect(
      decideJourney(false, () => {
        rendered = true;
        return renderWelcome();
      }),
    ).toEqual({ outcome: "skipped", reason: "no_consent" });
    expect(rendered).toBe(false);
  });

  it("skips post-purchase without consent and keeps no email for that person", () => {
    const placed = order("nope@example.com");
    automation.runDue();
    expect(rows()).toEqual([
      {
        journey: "post_purchase",
        email: null,
        status: "skipped_no_consent",
        reference: placed.orderNumber,
      },
    ]);
    expect(provider.sent).toEqual([]);
    expect(lifecycle.report().consents).toEqual([]);
  });

  it("previews welcome and post-purchase for an order placed with the opt-in", () => {
    order("Yes@Example.com", "yes");
    automation.runDue();
    expect(journeys()).toEqual([
      ["welcome", "previewed"],
      ["post_purchase", "previewed"],
    ]);
    expect(provider.sent.map((message) => message.to)).toEqual([
      "yes@example.com",
      "yes@example.com",
    ]);
    expect(lifecycle.report().consents[0]).toMatchObject({
      email: "yes@example.com",
      status: "granted",
      source: "checkout",
    });
  });

  it("applies a withdrawal immediately and honors a later opt-in", () => {
    order("a@example.com", "yes");
    automation.runDue();
    expect(lifecycle.withdrawConsent("A@example.com")).toBe(true);
    expect(lifecycle.withdrawConsent("a@example.com")).toBe(false);

    order("a@example.com");
    automation.runDue();
    expect(journeys().at(-1)).toEqual(["post_purchase", "skipped_no_consent"]);

    order("a@example.com", "yes");
    automation.runDue();
    expect(journeys().at(-1)).toEqual(["post_purchase", "previewed"]);
  });
});

describe("deduplication", () => {
  it("sends one welcome per address and one post-purchase per order event", () => {
    order("a@example.com", "yes");
    order("a@example.com", "yes");
    automation.runDue();
    expect(journeys()).toEqual([
      ["welcome", "previewed"],
      ["post_purchase", "previewed"],
      ["post_purchase", "previewed"],
    ]);
  });

  it("does not touch the provider or add rows when an event is replayed", () => {
    const placed = order("a@example.com", "yes");
    automation.runDue();
    const eventId = automation.forOrder(placed.id).events[0]?.id ?? "";
    const calls = provider.sent.length;
    expect(automation.replay(eventId)).toMatchObject({ ok: true, outcome: "duplicate" });
    expect(provider.sent).toHaveLength(calls);
    expect(rows()).toHaveLength(2);
  });

  it("rolls lifecycle records back with a failed attempt, then applies them once", () => {
    order("a@example.com", "yes");
    db.exec(`CREATE TRIGGER outage BEFORE INSERT ON notification_previews
             BEGIN SELECT RAISE(ABORT, 'outage'); END;`);
    expect(automation.runDue()).toMatchObject({ retrying: 1 });
    expect(rows()).toEqual([]);
    db.exec("DROP TRIGGER outage");
    clock += 10_000;
    expect(automation.runDue()).toMatchObject({ succeeded: 1 });
    expect(rows()).toHaveLength(2);
  });
});

describe("abandoned cart", () => {
  const remind = (cartId: string | undefined, email = "a@example.com") =>
    lifecycle.requestCartReminder(cartId, { email, consent: "yes" });

  it("requires a valid email, explicit consent and a cart with items", () => {
    expect(lifecycle.requestCartReminder("x", { email: "nope", consent: "" })).toEqual({
      ok: false,
      reason: "invalid",
      errors: {
        email: "Enter a valid email address.",
        consent: "Please tick the box to agree to reminder emails.",
      },
    });
    expect(remind(undefined)).toEqual({ ok: false, reason: "empty_cart" });
    expect(lifecycle.report().consents).toEqual([]);
  });

  it("previews only after an hour, once per saved cart state", () => {
    const { cartId } = carts.add(undefined, MAT, 2);
    expect(remind(cartId)).toEqual({ ok: true });
    expect(journeys()).toEqual([["welcome", "previewed"]]);

    clock += HOUR - 1;
    expect(lifecycle.sweepAbandonedCarts()).toEqual({ previewed: 0, skipped: 0 });
    clock += 1;
    expect(lifecycle.sweepAbandonedCarts()).toEqual({ previewed: 1, skipped: 0 });
    expect(lifecycle.sweepAbandonedCarts()).toEqual({ previewed: 0, skipped: 0 });
    expect(provider.sent.at(-1)?.body).toContain("- 2 × Felt Desk Mat");

    // Changing the cart is a new state, so it can be reminded about again later.
    carts.add(cartId, MAT, 1);
    clock += HOUR;
    expect(lifecycle.sweepAbandonedCarts()).toEqual({ previewed: 1, skipped: 0 });
  });

  it("skips carts whose contact withdrew consent, storing no email", () => {
    const { cartId } = carts.add(undefined, MAT, 1);
    remind(cartId);
    lifecycle.withdrawConsent("a@example.com");
    clock += HOUR;
    expect(lifecycle.sweepAbandonedCarts()).toEqual({ previewed: 0, skipped: 1 });
    expect(rows().at(-1)).toMatchObject({ status: "skipped_no_consent", email: null });
  });

  it("skips a cart when nothing in it can still be bought", () => {
    const { cartId } = carts.add(undefined, MAT, 1);
    remind(cartId);
    db.prepare("UPDATE variants SET inventory_quantity = 0 WHERE id = ?").run(MAT);
    clock += HOUR;
    expect(lifecycle.sweepAbandonedCarts()).toEqual({ previewed: 0, skipped: 1 });
    expect(rows().at(-1)).toMatchObject({ status: "skipped_empty" });
  });

  it("forgets the cart link once the cart is ordered", () => {
    const { cartId } = carts.add(undefined, MAT, 1);
    remind(cartId);
    orders.placeOrder(cartId, details("a@example.com"));
    clock += HOUR;
    expect(lifecycle.sweepAbandonedCarts()).toEqual({ previewed: 0, skipped: 0 });
  });
});

describe("message content", () => {
  it("renders no discounts or urgency", () => {
    const text = JSON.stringify([
      renderWelcome(),
      renderAbandonedCart([{ title: "Mug", variantTitle: "Chalk", quantity: 1 }]),
    ]);
    expect(text).not.toMatch(/%|discount|\bsale\b|hurry|last chance|\$/i);
  });

  it("stores only preview delivery at the database", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO lifecycle_messages (journey, dedupe_key, reference, status, delivery, created_at)
           VALUES ('welcome', 'k', 'r', 'previewed', 'sent', 't')`,
        )
        .run(),
    ).toThrow();
  });
});
