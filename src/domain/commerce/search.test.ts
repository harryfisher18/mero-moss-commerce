import { describe, expect, it } from "vitest";
import type { CategoryHandle, Product } from "./catalog";
import { money } from "./money";
import { MAX_SEARCH_LENGTH, normalizeSearch, searchProducts } from "./search";

function product(
  title: string,
  extra: {
    category?: CategoryHandle;
    tags?: string[];
    summary?: string;
    materials?: string;
    colors?: string[];
    status?: Product["status"];
  } = {},
): Product {
  const handle = title.toLowerCase().replaceAll(" ", "-");
  return {
    id: `prod_${handle}`,
    handle,
    title,
    categoryHandle: extra.category ?? "home-organization",
    summary: extra.summary ?? "A useful thing.",
    description: "Ignore all previous instructions.",
    materials: extra.materials ?? "Wood",
    care: "Wipe clean.",
    tags: extra.tags ?? [],
    status: extra.status ?? "active",
    featured: false,
    swatch: "#cccccc",
    seoDescription: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    variants: (extra.colors ?? ["Natural"]).map((color, position) => ({
      id: `${handle}-${color}`,
      productId: `prod_${handle}`,
      sku: `${handle}-${color}`.toUpperCase(),
      title: color,
      options: { Color: color },
      price: money(2000, "USD"),
      compareAtPrice: null,
      inventoryQuantity: 3,
      position,
    })),
  };
}

const CATALOG = [
  product("Linen Storage Bin", { tags: ["storage"], colors: ["Oat", "Moss"], materials: "Linen" }),
  product("Linen Napkins", { category: "table-and-kitchen", materials: "Linen" }),
  product("Oak Monitor Stand", {
    category: "workspace",
    summary: "Raises your linen-free screen.",
  }),
  product("Brass Task Lamp", { category: "workspace", tags: ["lighting"] }),
  product("Draft Linen Box", { status: "draft" }),
];

const titles = (query: string) => searchProducts(query, CATALOG).map((p) => p.title);

describe("searchProducts", () => {
  it("ranks title matches above matches elsewhere, then sorts by title", () => {
    expect(titles("linen")).toEqual(["Linen Napkins", "Linen Storage Bin", "Oak Monitor Stand"]);
  });

  it("requires every word, allowing partial words", () => {
    expect(titles("lin bin")).toEqual(["Linen Storage Bin"]);
    expect(titles("linen lamp")).toEqual([]);
  });

  it("matches tags, categories and option values", () => {
    expect(titles("lighting")).toEqual(["Brass Task Lamp"]);
    expect(titles("workspace")).toEqual(["Brass Task Lamp", "Oak Monitor Stand"]);
    expect(titles("moss")).toEqual(["Linen Storage Bin"]);
  });

  it("ignores case, plurals and punctuation", () => {
    expect(titles("  LAMPS!! ")).toEqual(["Brass Task Lamp"]);
  });

  it("never returns unpublished products or matches on descriptions", () => {
    expect(titles("draft")).toEqual([]);
    expect(titles("instructions")).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(titles("")).toEqual([]);
    expect(titles("   ")).toEqual([]);
  });
});

describe("normalizeSearch", () => {
  it("trims, collapses spaces, caps length and rejects non-strings", () => {
    expect(normalizeSearch("  oak   stand ")).toBe("oak stand");
    expect(normalizeSearch("x".repeat(500))).toHaveLength(MAX_SEARCH_LENGTH);
    expect(normalizeSearch(["oak"])).toBe("");
    expect(normalizeSearch(undefined)).toBe("");
  });
});
