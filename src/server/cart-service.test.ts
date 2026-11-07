import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Database, openDatabase } from "@/server/db/database";
import { seedDatabase } from "@/server/db/seed";
import { CartService, isCartId } from "./cart-service";

const CHARCOAL_LARGE = "var_mm-ws-fdm-chr-l"; // $58.00, stock 9
const TRIVET = "var_mm-tk-cit-1"; // $29.00, stock 2
const SOLD_OUT = "var_mm-ws-fdm-oat-l"; // stock 0

let db: Database;
let service: CartService;
let ids: number;

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
  ids = 0;
  service = new CartService(
    db,
    () => "2026-11-07T00:00:00.000Z",
    () => `00000000-0000-4000-8000-${String(++ids).padStart(12, "0")}`,
  );
});

afterEach(() => db.close());

describe("CartService", () => {
  it("creates a cart on first add and persists lines", () => {
    const { cartId, result } = service.add(undefined, CHARCOAL_LARGE, 2);
    expect(result.ok).toBe(true);
    expect(isCartId(cartId)).toBe(true);
    expect(service.getLines(cartId)).toEqual([{ variantId: CHARCOAL_LARGE, quantity: 2 }]);

    const cart = service.getCart(cartId);
    expect(cart.totals.subtotal.amountMinor).toBe(11600);
    expect(cart.totals.shippingEstimate.amountMinor).toBe(0);
    expect(cart.lines[0]?.productTitle).toBe("Felt Desk Mat");
  });

  it("does not create a cart when the first add is rejected", () => {
    const { cartId, result } = service.add(undefined, SOLD_OUT, 1);
    expect(result).toMatchObject({ ok: false, reason: "sold_out" });
    expect(cartId).toBe("");
    expect(db.prepare("SELECT COUNT(*) AS n FROM carts").get()?.n).toBe(0);
  });

  it("starts a new cart for unknown or malformed cart ids", () => {
    const forged = service.add("not-a-uuid", TRIVET, 1);
    expect(forged.cartId).not.toBe("not-a-uuid");
    const unknown = service.add("00000000-0000-4000-8000-999999999999", TRIVET, 1);
    expect(unknown.cartId).not.toBe("00000000-0000-4000-8000-999999999999");
  });

  it("validates combined quantity against current stock on every add", () => {
    const { cartId } = service.add(undefined, TRIVET, 2);
    expect(service.add(cartId, TRIVET, 1).result).toMatchObject({
      ok: false,
      reason: "insufficient_stock",
      maxQuantity: 0,
    });
    expect(service.getLines(cartId)).toEqual([{ variantId: TRIVET, quantity: 2 }]);
  });

  it("re-reads stock and status from the database for updates", () => {
    const { cartId } = service.add(undefined, CHARCOAL_LARGE, 1);
    db.prepare("UPDATE variants SET inventory_quantity = 3 WHERE id = ?").run(CHARCOAL_LARGE);
    expect(service.setQuantity(cartId, CHARCOAL_LARGE, 4)).toMatchObject({
      ok: false,
      reason: "insufficient_stock",
      maxQuantity: 3,
    });
    expect(service.setQuantity(cartId, CHARCOAL_LARGE, 3).ok).toBe(true);

    db.prepare("UPDATE products SET status = 'draft' WHERE handle = 'felt-desk-mat'").run();
    expect(service.setQuantity(cartId, CHARCOAL_LARGE, 2)).toMatchObject({
      reason: "product_unavailable",
    });
    expect(service.getCart(cartId).lines[0]?.issue).toBe("unavailable");
    expect(service.getCart(cartId).totals.subtotal.amountMinor).toBe(0);
  });

  it("removes lines and rejects mutations on carts it does not know", () => {
    const { cartId } = service.add(undefined, TRIVET, 1);
    service.add(cartId, CHARCOAL_LARGE, 1);
    expect(service.remove(cartId, TRIVET).ok).toBe(true);
    expect(service.getLines(cartId).map((l) => l.variantId)).toEqual([CHARCOAL_LARGE]);
    expect(service.remove(undefined, TRIVET)).toMatchObject({ reason: "line_not_found" });
    expect(service.getCart("garbage").lines).toEqual([]);
  });
});

describe("shipping policy consistency", () => {
  it("the cart shipping rule matches the stored shipping policy text", () => {
    const body = String(
      db.prepare("SELECT body FROM store_policies WHERE key = 'shipping'").get()?.body,
    );
    expect(body).toContain("free on orders of $75 or more");
    expect(body).toContain("costs $8 below that");
  });
});
