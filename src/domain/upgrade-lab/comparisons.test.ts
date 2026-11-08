import { describe, expect, it } from "vitest";
import type { Product, Variant } from "@/domain/commerce/catalog";
import { money } from "@/domain/commerce/money";
import {
  expectedTriage,
  improvedProductView,
  keywordSearch,
  LAB_ADD_PREVIEW,
  labProducts,
  LEGACY_ADD_ERROR,
  legacyAddMessage,
  legacyOrderNote,
  legacyProductView,
  parseLabParams,
  sampleOrderPayload,
  triageFeedback,
} from "./comparisons";

function variant(id: string, color: string, price: number, stock: number): Variant {
  return {
    id,
    productId: "p",
    sku: id.toUpperCase(),
    title: color,
    options: { Color: color },
    price: money(price, "USD"),
    compareAtPrice: null,
    inventoryQuantity: stock,
    position: 0,
  };
}

function product(
  title: string,
  variants: Variant[],
  status: Product["status"] = "active",
): Product {
  return {
    id: `prod_${title}`,
    handle: title.toLowerCase().replaceAll(" ", "-"),
    title,
    categoryHandle: "home-organization",
    summary: "Summary.",
    description: "Description.",
    materials: "Linen",
    care: "Wipe clean.",
    tags: [],
    status,
    featured: false,
    swatch: "#cccccc",
    seoDescription: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    variants: variants.map((v, position) => ({ ...v, position })),
  };
}

const BIN = product("Linen Storage Bin", [
  variant("oat", "Oat", 2800, 30),
  variant("moss", "Moss", 3400, 0),
]);
const MAT = product("Felt Desk Mat", [
  variant("c", "Charcoal", 5800, 9),
  variant("o", "Oat", 5800, 2),
]);
const MUG = product("Hand-Thrown Mug", [variant("m", "Chalk", 2400, 10)]);
const DRAFT = product(
  "Draft Storage Box",
  [variant("a", "A", 100, 1), variant("b", "B", 100, 0)],
  "draft",
);

describe("parseLabParams", () => {
  it("falls back to safe defaults for unusable input", () => {
    expect(parseLabParams({ lab: "nope", product: "x".repeat(200) })).toEqual({
      lab: "product",
      product: undefined,
      question: "",
      order: undefined,
    });
  });

  it("reads valid values, the first of repeated values, and caps the question", () => {
    const parsed = parseLabParams({ lab: ["orders", "product"], order: "o1", q: "a".repeat(400) });
    expect(parsed).toMatchObject({ lab: "orders", order: "o1" });
    expect(parsed.question).toHaveLength(300);
  });
});

describe("labProducts", () => {
  it("lists active multi-variant products, sold-out variants first", () => {
    expect(labProducts([MAT, MUG, DRAFT, BIN]).map((p) => p.title)).toEqual([
      "Linen Storage Bin",
      "Felt Desk Mat",
    ]);
  });
});

describe("mobile product page comparison", () => {
  it("before shows one from-price and no stock, and only fails after Add", () => {
    expect(legacyProductView(BIN)).toEqual({
      priceLabel: "From $28.00",
      choices: [
        { id: "oat", label: "Oat" },
        { id: "moss", label: "Moss" },
      ],
    });
    expect(legacyAddMessage(BIN, "oat")).toBe(LAB_ADD_PREVIEW);
    expect(legacyAddMessage(BIN, "moss")).toBe(LEGACY_ADD_ERROR);
  });

  it("after follows the selection with the real price, stock and option state", () => {
    expect(improvedProductView(BIN, "moss")).toMatchObject({
      variantId: "moss",
      price: { price: "$34.00", compareAt: null },
      availability: "Sold out",
      canBuy: false,
    });
    const view = improvedProductView(BIN, undefined);
    expect(view).toMatchObject({ variantId: "oat", availability: "In stock", canBuy: true });
    expect(view?.options[0]?.values.map((v) => [v.value, v.selected, v.soldOut])).toEqual([
      ["Oat", true, false],
      ["Moss", false, true],
    ]);
  });
});

describe("keywordSearch", () => {
  const catalog = [BIN, MAT, MUG, DRAFT];

  it("needs the whole phrase in a title and ignores budgets", () => {
    expect(keywordSearch("linen storage", catalog).map((r) => r.title)).toEqual([
      "Linen Storage Bin",
    ]);
    expect(keywordSearch("storage under $20", catalog)).toEqual([]);
    expect(keywordSearch("   ", catalog)).toEqual([]);
  });

  it("shows a price range and skips unpublished products", () => {
    expect(keywordSearch("storage", catalog)).toEqual([
      { title: "Linen Storage Bin", handle: "linen-storage-bin", priceLabel: "$28.00 – $34.00" },
    ]);
  });
});

describe("order operations comparison", () => {
  const payload = sampleOrderPayload([DRAFT, BIN]);
  if (!payload) throw new Error("expected a sample order");

  it("builds a sample from the first buyable active product, with store shipping", () => {
    expect(payload).toMatchObject({
      orderNumber: "Sample order",
      lines: [{ productTitle: "Linen Storage Bin", variantTitle: "Oat", quantity: 2 }],
      subtotalMinor: 5600,
      shippingMinor: 800,
      totalMinor: 6400,
    });
    expect(sampleOrderPayload([DRAFT])).toBeNull();
  });

  it("writes the note with personal data masked", () => {
    const note = legacyOrderNote(payload);
    expect(note).toContain("2x Linen Storage Bin Oat - $64.00 total, going to OR");
    expect(note).toContain("S. S. s***@example.com");
    expect(note).not.toContain("sample@example.com");
  });

  it("compares a manual decision with the automation rules", () => {
    const expected = expectedTriage(payload);
    expect(expected).toEqual({ zone: "west", needsReview: false });
    expect(triageFeedback(expected, { zone: "west", review: "no" })).toBe(
      "That matches the automation rules for this order.",
    );
    expect(triageFeedback(expected, { zone: "east", review: "yes" })).toBe(
      "The ship zone and review decision differ from the automation rules for this order.",
    );
    expect(triageFeedback(expected, { zone: "east", review: "no" })).toBe(
      "The ship zone differs from the automation rules for this order.",
    );
  });
});
