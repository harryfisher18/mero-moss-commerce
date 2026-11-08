import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/domain/merchant/credentials";
import { CartService } from "@/server/cart-service";
import { type Database, openDatabase } from "@/server/db/database";
import { seedDatabase } from "@/server/db/seed";
import { MerchantAuthService, SESSION_TTL_HOURS } from "./merchant-auth-service";
import { merchantCredentials } from "./merchant-config";
import { MerchantOrderService } from "./merchant-order-service";
import { OrderService } from "./order-service";

const credentials = {
  email: "owner@example.com",
  passwordHash: hashPassword("a-long-test-password"),
  isDemo: false,
};
const TRIVET = "var_mm-tk-cit-1";

let db: Database;
let clock: Date;
let auth: MerchantAuthService;

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
  clock = new Date("2026-11-07T10:00:00.000Z");
  auth = new MerchantAuthService(db, credentials, () => clock);
});

afterEach(() => db.close());

describe("merchant credentials config", () => {
  it("uses the documented demo login only when no credentials are configured", () => {
    expect(merchantCredentials({}).isDemo).toBe(true);
    expect(merchantCredentials({ MERCHANT_EMAIL: "a@b.c" }).isDemo).toBe(true);
    expect(
      merchantCredentials({ MERCHANT_EMAIL: "a@b.c", MERCHANT_PASSWORD_HASH: "scrypt$..." }),
    ).toMatchObject({ email: "a@b.c", isDemo: false });
  });
});

describe("MerchantAuthService", () => {
  it("issues a session for valid credentials and verifies it", () => {
    const result = auth.login(" Owner@Example.com ", "a-long-test-password");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(auth.verify(result.token)).toEqual({
      email: "owner@example.com",
      expiresAt: "2026-11-07T18:00:00.000Z",
    });
    // Only a digest of the token is stored.
    const stored = db.prepare("SELECT token_hash FROM merchant_sessions").get();
    expect(stored?.token_hash).not.toBe(result.token);
    expect(String(stored?.token_hash)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects wrong passwords, unknown emails, forged and expired tokens", () => {
    expect(auth.login("owner@example.com", "wrong")).toEqual({ ok: false, reason: "invalid" });
    expect(auth.login("intruder@example.com", "a-long-test-password")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(auth.verify("forged-token")).toBeNull();
    expect(auth.verify(undefined)).toBeNull();

    const result = auth.login("owner@example.com", "a-long-test-password");
    if (!result.ok) throw new Error("expected login");
    clock = new Date(clock.getTime() + SESSION_TTL_HOURS * 3_600_000);
    expect(auth.verify(result.token)).toBeNull();
  });

  it("locks an email after repeated failures, then recovers after the window", () => {
    for (let i = 0; i < 5; i++) auth.login("owner@example.com", "wrong");
    expect(auth.login("owner@example.com", "a-long-test-password")).toEqual({
      ok: false,
      reason: "locked",
    });
    clock = new Date(clock.getTime() + 16 * 60_000);
    expect(auth.login("owner@example.com", "a-long-test-password").ok).toBe(true);
  });

  it("logs out by deleting the session", () => {
    const result = auth.login("owner@example.com", "a-long-test-password");
    if (!result.ok) throw new Error("expected login");
    auth.logout(result.token);
    expect(auth.verify(result.token)).toBeNull();
  });
});

describe("MerchantOrderService", () => {
  function placeOrder(quantity: number) {
    const carts = new CartService(db);
    const { cartId } = carts.add(undefined, TRIVET, quantity);
    const placed = new OrderService(db).placeOrder(cartId, {
      email: "avery@example.com",
      fullName: "Avery Stone",
      address1: "12 Elm Street",
      address2: "",
      city: "Portland",
      region: "OR",
      postalCode: "97205",
      acknowledgeSimulated: "yes",
    });
    if (!placed.ok) throw new Error("expected order");
    return placed.order;
  }

  describe("order review", () => {
    const flag = (orderId: string) =>
      db
        .prepare(
          `INSERT INTO outbox_events (id, type, aggregate_id, subject, payload, max_attempts, next_attempt_at, created_at)
         VALUES (?, 'automation.drill', 'drill', 'x', '{}', 5, 't', 't')`,
        )
        .run(`evt-${orderId}`) &&
      db
        .prepare(
          "INSERT INTO order_tags (order_id, tag, source_event_id, created_at) VALUES (?, 'review:high-value', ?, 't')",
        )
        .run(orderId, `evt-${orderId}`);

    it("queues flagged orders and blocks processing on the server until cleared", () => {
      const order = placeOrder(1);
      const service = new MerchantOrderService(db, () => "2026-11-08T12:00:00.000Z");
      expect(service.listHeldForReview()).toEqual([]);
      expect(service.clearReview(order.id, "owner@example.com")).toEqual({
        ok: false,
        reason: "not_held",
      });

      flag(order.id);
      expect(service.listHeldForReview().map((o) => o.id)).toEqual([order.id]);
      expect(service.transition(order.id, "processing", "owner@example.com")).toEqual({
        ok: false,
        reason: "needs_review",
      });

      expect(service.clearReview(order.id, "owner@example.com")).toEqual({ ok: true });
      expect(service.review(order.id)).toMatchObject({
        kind: "cleared",
        clearance: { clearedBy: "owner@example.com" },
      });
      expect(service.listHeldForReview()).toEqual([]);
      expect(service.clearReview(order.id, "owner@example.com")).toEqual({
        ok: false,
        reason: "not_held",
      });
      expect(service.transition(order.id, "processing", "owner@example.com").ok).toBe(true);
    });

    it("still lets a merchant cancel a held order", () => {
      const order = placeOrder(1);
      flag(order.id);
      const service = new MerchantOrderService(db);
      expect(service.transition(order.id, "cancelled", "owner@example.com").ok).toBe(true);
      expect(service.listHeldForReview()).toEqual([]);
    });
  });
  const stock = () =>
    Number(db.prepare("SELECT inventory_quantity AS q FROM variants WHERE id = ?").get(TRIVET)?.q);

  it("lists new orders immediately with item counts and totals", () => {
    const order = placeOrder(2);
    const service = new MerchantOrderService(db);
    expect(service.list()).toEqual([
      expect.objectContaining({
        id: order.id,
        orderNumber: "MM-100001",
        status: "placed",
        customerName: "Avery Stone",
        itemCount: 2,
        // 2 × $29.00 = $58.00, below the free-shipping threshold, so $8.00 shipping applies.
        total: { amountMinor: 6600, currency: "USD" },
      }),
    ]);
    expect(service.list("fulfilled")).toEqual([]);
    expect(service.get(order.id)?.events).toEqual([
      expect.objectContaining({ fromStatus: null, toStatus: "placed" }),
    ]);
  });

  it("applies valid transitions with an audit trail and rejects invalid ones", () => {
    const order = placeOrder(1);
    const service = new MerchantOrderService(db, () => "2026-11-07T11:00:00.000Z");
    expect(service.transition(order.id, "fulfilled", "owner@example.com")).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
    expect(service.transition(order.id, "processing", "owner@example.com").ok).toBe(true);
    expect(service.transition(order.id, "fulfilled", "owner@example.com").ok).toBe(true);
    expect(service.transition(order.id, "cancelled", "owner@example.com")).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
    expect(service.transition("missing", "processing", "owner@example.com")).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(service.get(order.id)?.events.map((e) => [e.fromStatus, e.toStatus, e.actor])).toEqual([
      [null, "placed", "Shopper (storefront checkout)"],
      ["placed", "processing", "owner@example.com"],
      ["processing", "fulfilled", "owner@example.com"],
    ]);
    expect(stock()).toBe(1);
  });

  it("returns stock when an unshipped order is cancelled", () => {
    const order = placeOrder(2);
    expect(stock()).toBe(0);
    expect(new MerchantOrderService(db).transition(order.id, "cancelled", "owner").ok).toBe(true);
    expect(stock()).toBe(2);
  });
});
