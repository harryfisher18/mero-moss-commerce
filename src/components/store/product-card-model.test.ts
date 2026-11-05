import { describe, expect, it } from "vitest";
import type { Product, Variant } from "@/domain/commerce/catalog";
import { money } from "@/domain/commerce/money";
import { toProductCardModel } from "./product-card-model";

function product(variants: Array<Partial<Variant>>): Product {
  return {
    id: "prod_x",
    handle: "x",
    title: "Linen Storage Bin",
    categoryHandle: "home-organization",
    summary: "Soft-sided bin.",
    description: "",
    materials: "",
    care: "",
    tags: [],
    status: "active",
    featured: false,
    swatch: "#cccccc",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    variants: variants.map((v, i) => ({
      id: `v${i}`,
      productId: "prod_x",
      sku: `SKU-${i}`,
      title: "Default",
      options: {},
      price: money(2800, "USD"),
      compareAtPrice: null,
      inventoryQuantity: 10,
      position: i,
      ...v,
    })),
  };
}

describe("toProductCardModel", () => {
  it("shows a single price when all variants cost the same", () => {
    const model = toProductCardModel(
      product([{ options: { Color: "Oat" } }, { options: { Color: "Charcoal" } }]),
    );
    expect(model.priceLabel).toBe("$28.00");
    expect(model.optionsLabel).toBe("2 colors");
    expect(model.availabilityLabel).toBeNull();
  });

  it("shows a 'From' price when variant prices differ", () => {
    const model = toProductCardModel(
      product([
        { price: money(5400, "USD"), options: { Size: "Large" } },
        { price: money(3400, "USD"), options: { Size: "Small" } },
      ]),
    );
    expect(model.priceLabel).toBe("From $34.00");
    expect(model.optionsLabel).toBe("2 sizes");
  });

  it("labels low stock and sold out from real inventory", () => {
    expect(toProductCardModel(product([{ inventoryQuantity: 2 }])).availabilityLabel).toBe(
      "Low stock",
    );
    const soldOut = toProductCardModel(product([{ inventoryQuantity: 0 }]));
    expect(soldOut.availabilityLabel).toBe("Sold out");
    expect(soldOut.soldOut).toBe(true);
  });

  it("omits the options label for single-variant products", () => {
    expect(toProductCardModel(product([{}])).optionsLabel).toBeNull();
  });
});

describe("toProductCardModel with filtered variants", () => {
  it("prices from the variants that match active filters", () => {
    const filtered = product([
      { price: money(3400, "USD"), options: { Size: "Small" } },
      { price: money(5400, "USD"), options: { Size: "Large" } },
    ]);
    const large = filtered.variants.filter((variant) => variant.options.Size === "Large");
    expect(toProductCardModel(filtered, large).priceLabel).toBe("$54.00");
  });
});
