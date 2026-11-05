import { describe, expect, it } from "vitest";
import {
  isCategoryHandle,
  isPurchasable,
  optionMatrix,
  priceRange,
  productAvailability,
  totalInventory,
  type Variant,
  variantAvailability,
} from "./catalog";
import { money } from "./money";

function variant(overrides: Partial<Variant> & Pick<Variant, "id">): Variant {
  return {
    productId: "prod_test",
    sku: overrides.id.toUpperCase(),
    title: "Default",
    options: {},
    price: money(1000, "USD"),
    compareAtPrice: null,
    inventoryQuantity: 10,
    position: 0,
    ...overrides,
  };
}

describe("variant and product availability", () => {
  it("classifies stock levels", () => {
    expect(variantAvailability({ inventoryQuantity: 0 })).toBe("sold_out");
    expect(variantAvailability({ inventoryQuantity: 5 })).toBe("low_stock");
    expect(variantAvailability({ inventoryQuantity: 6 })).toBe("in_stock");
  });

  it("is sold out only when every variant is sold out", () => {
    expect(
      productAvailability({
        variants: [
          variant({ id: "a", inventoryQuantity: 0 }),
          variant({ id: "b", inventoryQuantity: 0 }),
        ],
      }),
    ).toBe("sold_out");
    expect(
      productAvailability({
        variants: [
          variant({ id: "a", inventoryQuantity: 0 }),
          variant({ id: "b", inventoryQuantity: 2 }),
        ],
      }),
    ).toBe("low_stock");
    expect(
      productAvailability({
        variants: [
          variant({ id: "a", inventoryQuantity: 0 }),
          variant({ id: "b", inventoryQuantity: 20 }),
        ],
      }),
    ).toBe("in_stock");
  });

  it("totals inventory across variants", () => {
    expect(
      totalInventory({
        variants: [
          variant({ id: "a", inventoryQuantity: 3 }),
          variant({ id: "b", inventoryQuantity: 4 }),
        ],
      }),
    ).toBe(7);
  });
});

describe("priceRange", () => {
  it("returns min and max variant prices", () => {
    const range = priceRange({
      variants: [
        variant({ id: "a", price: money(4200, "USD") }),
        variant({ id: "b", price: money(3400, "USD") }),
        variant({ id: "c", price: money(5400, "USD") }),
      ],
    });
    expect(range.min.amountMinor).toBe(3400);
    expect(range.max.amountMinor).toBe(5400);
  });

  it("throws for a product without variants", () => {
    expect(() => priceRange({ variants: [] })).toThrow();
  });
});

describe("isPurchasable", () => {
  it("requires an active product and stock", () => {
    const inStock = variant({ id: "a", inventoryQuantity: 1 });
    const soldOut = variant({ id: "b", inventoryQuantity: 0 });
    expect(isPurchasable({ status: "active" }, inStock)).toBe(true);
    expect(isPurchasable({ status: "active" }, soldOut)).toBe(false);
    expect(isPurchasable({ status: "draft" }, inStock)).toBe(false);
  });
});

describe("optionMatrix", () => {
  it("lists distinct option values in variant order", () => {
    const matrix = optionMatrix({
      variants: [
        variant({ id: "b", position: 1, options: { Color: "Charcoal", Size: "Large" } }),
        variant({ id: "a", position: 0, options: { Color: "Charcoal", Size: "Medium" } }),
        variant({ id: "c", position: 2, options: { Color: "Oat", Size: "Medium" } }),
      ],
    });
    expect(matrix).toEqual([
      { name: "Color", values: ["Charcoal", "Oat"] },
      { name: "Size", values: ["Medium", "Large"] },
    ]);
  });
});

describe("isCategoryHandle", () => {
  it("accepts known handles only", () => {
    expect(isCategoryHandle("workspace")).toBe(true);
    expect(isCategoryHandle("electronics")).toBe(false);
  });
});
