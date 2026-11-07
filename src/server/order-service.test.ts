import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CheckoutDetails } from "@/domain/commerce/order";
import { CartService } from "@/server/cart-service";
import { type Database, openDatabase } from "@/server/db/database";
import { seedDatabase } from "@/server/db/seed";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";
import { OrderService } from "./order-service";

const TRIVET = "var_mm-tk-cit-1"; // $29.00, stock 2
const MAT_LARGE = "var_mm-ws-fdm-chr-l"; // $58.00, stock 9

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
let carts: CartService;
let orders: OrderService;
let counter: number;

const stock = (variantId: string) =>
  Number(db.prepare("SELECT inventory_quantity AS q FROM variants WHERE id = ?").get(variantId)?.q);
const orderCount = () => Number(db.prepare("SELECT COUNT(*) AS n FROM orders").get()?.n);

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
  counter = 0;
  const id = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
  const now = () => "2026-11-07T12:00:00.000Z";
  carts = new CartService(db, now, id);
  orders = new OrderService(db, now, id);
});

afterEach(() => db.close());

describe("OrderService.placeOrder", () => {
  it("creates a simulated order, decrements stock and clears the cart atomically", () => {
    const { cartId } = carts.add(undefined, MAT_LARGE, 2);
    carts.add(cartId, TRIVET, 1);

    const result = orders.placeOrder(cartId, details);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order).toMatchObject({
      orderNumber: "MM-100001",
      status: "placed",
      isSimulated: true,
      email: "avery@example.com",
      shippingAddress: { city: "Portland", region: "OR", country: "US" },
    });
    expect(result.order.lines.map((line) => [line.sku, line.quantity])).toEqual([
      ["MM-WS-FDM-CHR-L", 2],
      ["MM-TK-CIT-1", 1],
    ]);
    expect(result.order.subtotal.amountMinor).toBe(14500);
    expect(result.order.shipping.amountMinor).toBe(0);
    expect(result.order.total.amountMinor).toBe(14500);

    expect(stock(MAT_LARGE)).toBe(7);
    expect(stock(TRIVET)).toBe(1);
    expect(carts.getLines(cartId)).toEqual([]);
    expect(orders.getOrderByConfirmationToken(result.confirmationToken)?.id).toBe(result.order.id);
  });

  it("prevents overselling the last units across two shoppers", () => {
    const first = carts.add(undefined, TRIVET, 2).cartId;
    const second = carts.add(undefined, TRIVET, 2).cartId;

    expect(orders.placeOrder(first, details).ok).toBe(true);
    expect(stock(TRIVET)).toBe(0);

    const late = orders.placeOrder(second, details);
    expect(late).toEqual({
      ok: false,
      reason: "problems",
      problems: [
        { variantId: TRIVET, productTitle: "Cast Iron Trivet", reason: "sold_out", available: 0 },
      ],
    });
    expect(stock(TRIVET)).toBe(0);
    expect(orderCount()).toBe(1);
    // The losing cart is kept so the shopper can adjust it.
    expect(carts.getLines(second)).toEqual([{ variantId: TRIVET, quantity: 2 }]);
  });

  it("rejects partial stock without creating an order or touching inventory", () => {
    const cartId = carts.add(undefined, TRIVET, 2).cartId;
    carts.add(cartId, MAT_LARGE, 1);
    db.prepare("UPDATE variants SET inventory_quantity = 1 WHERE id = ?").run(TRIVET);

    expect(orders.placeOrder(cartId, details)).toMatchObject({
      ok: false,
      reason: "problems",
      problems: [{ variantId: TRIVET, reason: "insufficient_stock", available: 1 }],
    });
    expect(stock(MAT_LARGE)).toBe(9);
    expect(orderCount()).toBe(0);
  });

  it("rejects unpublished products and empty or unknown carts", () => {
    const cartId = carts.add(undefined, MAT_LARGE, 1).cartId;
    db.prepare("UPDATE products SET status = 'draft' WHERE handle = 'felt-desk-mat'").run();
    expect(orders.placeOrder(cartId, details)).toMatchObject({
      reason: "problems",
      problems: [{ reason: "unavailable" }],
    });
    expect(orders.placeOrder(undefined, details)).toEqual({ ok: false, reason: "empty_cart" });
    expect(orders.placeOrder("00000000-0000-4000-8000-999999999999", details)).toEqual({
      ok: false,
      reason: "empty_cart",
    });
    expect(orderCount()).toBe(0);
  });

  it("assigns sequential order numbers", () => {
    const a = orders.placeOrder(carts.add(undefined, MAT_LARGE, 1).cartId, details);
    const b = orders.placeOrder(carts.add(undefined, MAT_LARGE, 1).cartId, details);
    expect([a.ok && a.order.orderNumber, b.ok && b.order.orderNumber]).toEqual([
      "MM-100001",
      "MM-100002",
    ]);
  });

  it("enforces simulated-only orders at the schema level", () => {
    orders.placeOrder(carts.add(undefined, MAT_LARGE, 1).cartId, details);
    expect(() => db.prepare("UPDATE orders SET is_simulated = 0").run()).toThrow();
  });
});

describe("guarded inventory decrement", () => {
  it("refuses to decrement below zero and leaves stock unchanged", () => {
    const catalog = new SqliteCatalogRepository(db);
    expect(catalog.decrementInventory(TRIVET, 3)).toBe(false);
    expect(stock(TRIVET)).toBe(2);
    expect(catalog.decrementInventory(TRIVET, 2)).toBe(true);
    expect(stock(TRIVET)).toBe(0);
  });
});
