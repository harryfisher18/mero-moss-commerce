import { describe, expect, it } from "vitest";
import {
  addLine,
  type CartLine,
  cartItemCount,
  type CatalogEntry,
  MAX_CART_LINES,
  priceCart,
  rejectionMessage,
  removeLine,
  setLineQuantity,
} from "./cart";
import type { Product, Variant } from "./catalog";
import { money } from "./money";

function entry(
  id: string,
  priceMinor: number,
  inventory: number,
  status: Product["status"] = "active",
): CatalogEntry {
  const variant: Variant = {
    id,
    productId: `prod_${id}`,
    sku: id.toUpperCase(),
    title: "Default",
    options: {},
    price: money(priceMinor, "USD"),
    compareAtPrice: null,
    inventoryQuantity: inventory,
    position: 0,
  };
  const product: Product = {
    id: `prod_${id}`,
    handle: id,
    title: `Product ${id}`,
    categoryHandle: "workspace",
    summary: "",
    description: "",
    materials: "",
    care: "",
    tags: [],
    status,
    featured: false,
    swatch: "#000",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    variants: [variant],
  };
  return { product, variant };
}

const mug = entry("mug", 2600, 35);
const trivet = entry("trivet", 2900, 2);
const soldOut = entry("gone", 1000, 0);

describe("addLine", () => {
  it("adds a new line and merges quantities for the same variant", () => {
    const first = addLine([], mug, "mug", 2);
    expect(first).toEqual({ ok: true, lines: [{ variantId: "mug", quantity: 2 }] });
    const second = addLine(first.ok ? first.lines : [], mug, "mug", 3);
    expect(second).toEqual({ ok: true, lines: [{ variantId: "mug", quantity: 5 }] });
  });

  it("bounds the combined quantity by stock and reports what is left", () => {
    const lines: CartLine[] = [{ variantId: "trivet", quantity: 2 }];
    expect(addLine(lines, trivet, "trivet", 1)).toEqual({
      ok: false,
      reason: "insufficient_stock",
      maxQuantity: 0,
    });
    expect(addLine([{ variantId: "trivet", quantity: 1 }], trivet, "trivet", 2)).toEqual({
      ok: false,
      reason: "insufficient_stock",
      maxQuantity: 1,
    });
  });

  it("enforces the per-line cap even with plenty of stock", () => {
    expect(addLine([{ variantId: "mug", quantity: 9 }], mug, "mug", 2)).toMatchObject({
      ok: false,
      reason: "insufficient_stock",
      maxQuantity: 1,
    });
  });

  it("rejects sold-out, unknown, inactive and invalid quantities", () => {
    expect(addLine([], soldOut, "gone", 1)).toMatchObject({ reason: "sold_out" });
    expect(addLine([], undefined, "nope", 1)).toMatchObject({ reason: "variant_not_found" });
    expect(addLine([], entry("draft", 1000, 5, "draft"), "draft", 1)).toMatchObject({
      reason: "product_unavailable",
    });
    expect(addLine([], mug, "mug", 0)).toMatchObject({ reason: "invalid_quantity" });
    expect(addLine([], mug, "mug", 1.5)).toMatchObject({ reason: "invalid_quantity" });
  });

  it("limits the number of distinct lines", () => {
    const full = Array.from({ length: MAX_CART_LINES }, (_, i) => ({
      variantId: `v${i}`,
      quantity: 1,
    }));
    expect(addLine(full, mug, "mug", 1)).toMatchObject({ reason: "cart_full" });
  });
});

describe("setLineQuantity and removeLine", () => {
  const lines: CartLine[] = [
    { variantId: "mug", quantity: 2 },
    { variantId: "trivet", quantity: 1 },
  ];

  it("updates a line within stock", () => {
    expect(setLineQuantity(lines, mug, "mug", 4)).toEqual({
      ok: true,
      lines: [
        { variantId: "mug", quantity: 4 },
        { variantId: "trivet", quantity: 1 },
      ],
    });
  });

  it("rejects quantities above stock with the absolute maximum", () => {
    expect(setLineQuantity(lines, trivet, "trivet", 3)).toEqual({
      ok: false,
      reason: "insufficient_stock",
      maxQuantity: 2,
    });
  });

  it("treats 0 as remove and rejects lines not in the cart", () => {
    expect(setLineQuantity(lines, mug, "mug", 0)).toEqual({
      ok: true,
      lines: [{ variantId: "trivet", quantity: 1 }],
    });
    expect(setLineQuantity(lines, soldOut, "gone", 1)).toMatchObject({ reason: "line_not_found" });
    expect(removeLine(lines, "trivet")).toEqual({
      ok: true,
      lines: [{ variantId: "mug", quantity: 2 }],
    });
    expect(removeLine([], "trivet")).toMatchObject({ reason: "line_not_found" });
  });
});

describe("priceCart", () => {
  const catalog = new Map([
    ["mug", mug],
    ["trivet", trivet],
    ["gone", soldOut],
  ]);

  it("totals in minor units and adds the flat shipping estimate below the threshold", () => {
    const cart = priceCart([{ variantId: "mug", quantity: 2 }], catalog);
    expect(cart.totals.subtotal).toEqual({ amountMinor: 5200, currency: "USD" });
    expect(cart.totals.shippingEstimate.amountMinor).toBe(800);
    expect(cart.totals.estimatedTotal.amountMinor).toBe(6000);
    expect(cart.totals.freeShippingRemaining?.amountMinor).toBe(2300);
    expect(cart.totals.itemCount).toBe(2);
    expect(cart.hasIssues).toBe(false);
  });

  it("ships free at or above the threshold", () => {
    const cart = priceCart(
      [
        { variantId: "mug", quantity: 1 },
        { variantId: "trivet", quantity: 2 },
      ],
      catalog,
    );
    expect(cart.totals.subtotal.amountMinor).toBe(8400);
    expect(cart.totals.shippingEstimate.amountMinor).toBe(0);
    expect(cart.totals.freeShippingRemaining).toBeNull();
  });

  it("flags lines whose stock dropped or that disappeared, excluding them from totals", () => {
    const cart = priceCart(
      [
        { variantId: "trivet", quantity: 5 },
        { variantId: "gone", quantity: 1 },
        { variantId: "deleted", quantity: 1 },
      ],
      catalog,
    );
    expect(cart.lines.map((line) => [line.variantId, line.quantity, line.issue])).toEqual([
      ["trivet", 2, "quantity_reduced"],
      ["gone", 0, "sold_out"],
      ["deleted", 0, "unavailable"],
    ]);
    expect(cart.totals.subtotal.amountMinor).toBe(5800);
    expect(cart.hasIssues).toBe(true);
  });

  it("charges no shipping for an empty cart", () => {
    const cart = priceCart([], catalog);
    expect(cart.totals.estimatedTotal.amountMinor).toBe(0);
    expect(cart.totals.freeShippingRemaining).toBeNull();
  });
});

describe("helpers", () => {
  it("counts units and explains rejections", () => {
    expect(
      cartItemCount([
        { variantId: "a", quantity: 2 },
        { variantId: "b", quantity: 3 },
      ]),
    ).toBe(5);
    expect(rejectionMessage("insufficient_stock", 1)).toBe(
      "Only 1 more can be added to your cart.",
    );
    expect(rejectionMessage("insufficient_stock", 0)).toBe(
      "You already have all available stock of this item in your cart.",
    );
    expect(rejectionMessage("insufficient_stock", 2, "update")).toBe(
      "Only 2 available. Please choose fewer.",
    );
  });
});
