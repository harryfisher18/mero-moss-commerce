import { describe, expect, it } from "vitest";
import type { Product, Variant } from "./catalog";
import { money } from "./money";
import {
  availabilityMessage,
  defaultVariant,
  MAX_QUANTITY_PER_LINE,
  maxPurchasableQuantity,
  optionStates,
  priceDisplay,
  relatedProducts,
  resolveSelectedVariant,
  validatePurchase,
} from "./variant-selection";

function v(id: string, options: Record<string, string>, inventory: number, position: number) {
  return {
    id,
    productId: "prod_mat",
    sku: id.toUpperCase(),
    title: Object.values(options).join(" / "),
    options,
    price: money(options.Size === "Large" ? 5800 : 4800, "USD"),
    compareAtPrice: null,
    inventoryQuantity: inventory,
    position,
  } satisfies Variant;
}

const variants = [
  v("chr-m", { Color: "Charcoal", Size: "Medium" }, 0, 0),
  v("chr-l", { Color: "Charcoal", Size: "Large" }, 9, 1),
  v("oat-m", { Color: "Oat", Size: "Medium" }, 6, 2),
  v("oat-l", { Color: "Oat", Size: "Large" }, 0, 3),
];

function product(extra: Partial<Product> = {}): Product {
  return {
    id: "prod_mat",
    handle: "felt-desk-mat",
    title: "Felt Desk Mat",
    categoryHandle: "workspace",
    summary: "",
    description: "",
    materials: "",
    care: "",
    tags: [],
    status: "active",
    featured: false,
    swatch: "#000",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    variants,
    ...extra,
  };
}

describe("selected variant", () => {
  it("defaults to the first in-stock variant by position", () => {
    expect(defaultVariant(product())?.id).toBe("chr-l");
    const allSoldOut = product({ variants: variants.map((x) => ({ ...x, inventoryQuantity: 0 })) });
    expect(defaultVariant(allSoldOut)?.id).toBe("chr-m");
    expect(defaultVariant({ variants: [] })).toBeNull();
  });

  it("honours a valid ?variant id and ignores unknown ones", () => {
    expect(resolveSelectedVariant(product(), "oat-m")?.id).toBe("oat-m");
    expect(resolveSelectedVariant(product(), "oat-l")?.id).toBe("oat-l");
    expect(resolveSelectedVariant(product(), "var_from_another_product")?.id).toBe("chr-l");
    expect(resolveSelectedVariant(product(), undefined)?.id).toBe("chr-l");
  });
});

describe("optionStates", () => {
  it("keeps other selections when the combination exists", () => {
    const states = optionStates(product(), variants[1] as Variant); // Charcoal / Large
    const color = states.find((s) => s.name === "Color");
    const size = states.find((s) => s.name === "Size");
    expect(color?.values).toEqual([
      { value: "Charcoal", selected: true, variantId: "chr-l", exactMatch: true, soldOut: false },
      { value: "Oat", selected: false, variantId: "oat-l", exactMatch: true, soldOut: true },
    ]);
    expect(size?.values).toEqual([
      { value: "Medium", selected: false, variantId: "chr-m", exactMatch: true, soldOut: true },
      { value: "Large", selected: true, variantId: "chr-l", exactMatch: true, soldOut: false },
    ]);
  });

  it("falls back to an in-stock variant when the combination does not exist", () => {
    const partial = product({
      variants: [
        v("a", { Color: "Charcoal", Size: "Large" }, 3, 0),
        v("b", { Color: "Oat", Size: "Medium" }, 0, 1),
        v("c", { Color: "Oat", Size: "Small" }, 4, 2),
      ],
    });
    const color = optionStates(partial, partial.variants[0] as Variant).find(
      (s) => s.name === "Color",
    );
    expect(color?.values[1]).toEqual({
      value: "Oat",
      selected: false,
      variantId: "c",
      exactMatch: false,
      soldOut: false,
    });
  });

  it("omits options with a single value", () => {
    const single = product({
      variants: [v("x", { Color: "Tan" }, 2, 0)],
    });
    expect(optionStates(single, single.variants[0] as Variant)).toEqual([]);
  });
});

describe("price and availability display", () => {
  it("shows compare-at only when genuinely higher", () => {
    expect(priceDisplay({ price: money(4800, "USD"), compareAtPrice: null })).toEqual({
      price: "$48.00",
      compareAt: null,
    });
    expect(
      priceDisplay({ price: money(4800, "USD"), compareAtPrice: money(6000, "USD") }).compareAt,
    ).toBe("$60.00");
    expect(
      priceDisplay({ price: money(4800, "USD"), compareAtPrice: money(4800, "USD") }).compareAt,
    ).toBeNull();
  });

  it("describes stock from real inventory", () => {
    expect(availabilityMessage({ inventoryQuantity: 0 })).toBe("Sold out");
    expect(availabilityMessage({ inventoryQuantity: 3 })).toBe("Only 3 left in stock");
    expect(availabilityMessage({ inventoryQuantity: 40 })).toBe("In stock");
  });

  it("bounds the purchasable quantity by stock and the per-line cap", () => {
    expect(maxPurchasableQuantity({ inventoryQuantity: 0 })).toBe(0);
    expect(maxPurchasableQuantity({ inventoryQuantity: 4 })).toBe(4);
    expect(maxPurchasableQuantity({ inventoryQuantity: 500 })).toBe(MAX_QUANTITY_PER_LINE);
  });
});

describe("validatePurchase", () => {
  it("accepts an in-stock variant within limits", () => {
    const check = validatePurchase(product(), "chr-l", 2);
    expect(check.ok).toBe(true);
  });

  it("rejects sold-out variants", () => {
    expect(validatePurchase(product(), "chr-m", 1)).toEqual({
      ok: false,
      reason: "sold_out",
      maxQuantity: 0,
    });
  });

  it("rejects quantities above stock or the cap, and non-integer quantities", () => {
    expect(validatePurchase(product(), "oat-m", 7)).toMatchObject({
      ok: false,
      reason: "insufficient_stock",
      maxQuantity: 6,
    });
    expect(validatePurchase(product(), "oat-m", 0)).toMatchObject({ reason: "invalid_quantity" });
    expect(validatePurchase(product(), "oat-m", 1.5)).toMatchObject({
      reason: "invalid_quantity",
    });
    expect(validatePurchase(product(), "oat-m", Number.NaN)).toMatchObject({
      reason: "invalid_quantity",
    });
  });

  it("rejects unknown variants and inactive products", () => {
    expect(validatePurchase(product(), "nope", 1)).toMatchObject({ reason: "variant_not_found" });
    expect(validatePurchase(product({ status: "draft" }), "chr-l", 1)).toMatchObject({
      reason: "product_unavailable",
    });
  });
});

describe("relatedProducts", () => {
  const base = product();
  const make = (id: string, category: Product["categoryHandle"], inventory: number) =>
    product({
      id,
      handle: id,
      categoryHandle: category,
      variants: [v(`${id}-v`, {}, inventory, 0)],
    });

  it("prefers same-category, in-stock products and excludes the current one", () => {
    const candidates = [
      base,
      make("travel-a", "travel-essentials", 5),
      make("desk-sold-out", "workspace", 0),
      make("desk-a", "workspace", 5),
      make("desk-b", "workspace", 5),
      { ...make("desk-draft", "workspace", 5), status: "draft" as const },
    ];
    expect(relatedProducts(base, candidates, 4).map((p) => p.id)).toEqual([
      "desk-a",
      "desk-b",
      "desk-sold-out",
      "travel-a",
    ]);
  });
});
