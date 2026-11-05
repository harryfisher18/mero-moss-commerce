import { describe, expect, it } from "vitest";
import type { Product, Variant } from "./catalog";
import {
  DEFAULT_COLLECTION_QUERY,
  filterProducts,
  hasActiveFilters,
  optionFacets,
  paginate,
  parseCollectionQuery,
  queryCollection,
  serializeCollectionQuery,
  sortItems,
} from "./collection-query";
import { money } from "./money";

let seq = 0;
function v(partial: Partial<Variant> = {}): Variant {
  seq += 1;
  return {
    id: `var_${seq}`,
    productId: "p",
    sku: `SKU-${seq}`,
    title: "Default",
    options: {},
    price: money(2000, "USD"),
    compareAtPrice: null,
    inventoryQuantity: 10,
    position: seq,
    ...partial,
  };
}

function p(handle: string, variants: Variant[], extra: Partial<Product> = {}): Product {
  return {
    id: `prod_${handle}`,
    handle,
    title: handle,
    categoryHandle: "workspace",
    summary: "",
    description: "",
    materials: "",
    care: "",
    tags: [],
    status: "active",
    featured: false,
    swatch: "#000000",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    variants,
    ...extra,
  };
}

const mat = p("felt-desk-mat", [
  v({ options: { Color: "Charcoal", Size: "Medium" }, price: money(4800, "USD") }),
  v({ options: { Color: "Charcoal", Size: "Large" }, price: money(5800, "USD") }),
  v({
    options: { Color: "Oat", Size: "Large" },
    price: money(5800, "USD"),
    inventoryQuantity: 0,
  }),
]);
const lamp = p("lamp", [v({ options: { Finish: "Brass" }, price: money(14800, "USD") })], {
  createdAt: "2026-10-01T00:00:00.000Z",
});
const cup = p("cup", [v({ options: { Color: "Oat" }, price: money(1800, "USD") })], {
  featured: true,
  createdAt: "2026-05-01T00:00:00.000Z",
});
const products = [mat, lamp, cup];
const facets = optionFacets(products);

describe("parseCollectionQuery", () => {
  it("returns defaults for empty params", () => {
    expect(parseCollectionQuery({}, facets)).toEqual(DEFAULT_COLLECTION_QUERY);
  });

  it("parses valid params", () => {
    const query = parseCollectionQuery(
      {
        sort: "price-desc",
        availability: "in-stock",
        price: "50-100",
        color: ["oat", "Charcoal"],
        page: "2",
      },
      facets,
    );
    expect(query).toEqual({
      sort: "price-desc",
      inStockOnly: true,
      price: "50-100",
      options: { Color: ["Oat", "Charcoal"] },
      page: 2,
    });
  });

  it("falls back safely for invalid or unknown values", () => {
    const query = parseCollectionQuery(
      {
        sort: "cheapest",
        availability: "maybe",
        price: "free",
        color: "Neon",
        material: "Gold",
        page: "-4",
      },
      facets,
    );
    expect(query).toEqual(DEFAULT_COLLECTION_QUERY);
    expect(parseCollectionQuery({ page: "abc" }, facets).page).toBe(1);
    expect(parseCollectionQuery({ page: "1.5" }, facets).page).toBe(1);
    expect(parseCollectionQuery({ sort: ["newest", "featured"] }, facets).sort).toBe("newest");
  });
});

describe("serializeCollectionQuery", () => {
  it("omits defaults and produces a stable order", () => {
    expect(serializeCollectionQuery(DEFAULT_COLLECTION_QUERY)).toBe("");
    const query = {
      sort: "newest" as const,
      inStockOnly: true,
      price: "25-50" as const,
      options: { Size: ["Large"], Color: ["Oat", "Charcoal"] },
      page: 3,
    };
    expect(serializeCollectionQuery(query)).toBe(
      "?availability=in-stock&price=25-50&color=Charcoal&color=Oat&size=Large&sort=newest&page=3",
    );
  });

  it("round-trips through the parser", () => {
    const query = parseCollectionQuery(
      { color: "Oat", price: "under-25", sort: "price-asc" },
      facets,
    );
    const params = Object.fromEntries(new URLSearchParams(serializeCollectionQuery(query)));
    expect(parseCollectionQuery(params, facets)).toEqual(query);
  });
});

describe("filterProducts", () => {
  const q = (params: Record<string, string | string[]>) => parseCollectionQuery(params, facets);

  it("requires one variant to satisfy all variant-level filters together", () => {
    // Oat + Large exists only as a sold-out variant, so in-stock excludes the mat.
    const handles = filterProducts(
      products,
      q({ color: "Oat", size: "Large", availability: "in-stock" }),
    ).map((i) => i.product.handle);
    expect(handles).toEqual([]);
    expect(
      filterProducts(products, q({ color: "Oat", size: "Large" })).map((i) => i.product.handle),
    ).toEqual(["felt-desk-mat"]);
  });

  it("filters by price band using variant prices", () => {
    const items = filterProducts(products, q({ price: "50-100" }));
    expect(items.map((i) => i.product.handle)).toEqual(["felt-desk-mat"]);
    expect(items[0]?.matches.map((m) => m.price.amountMinor)).toEqual([5800, 5800]);
  });

  it("treats multiple values of one option as OR", () => {
    expect(
      filterProducts(products, q({ color: ["Oat", "Charcoal"] })).map((i) => i.product.handle),
    ).toEqual(["felt-desk-mat", "cup"]);
  });

  it("excludes products whose every variant is sold out when in-stock only", () => {
    const soldOut = p("gone", [v({ inventoryQuantity: 0 })]);
    expect(filterProducts([soldOut], q({ availability: "in-stock" }))).toEqual([]);
    expect(filterProducts([soldOut], q({}))).toHaveLength(1);
  });
});

describe("sortItems", () => {
  const all = filterProducts(products, DEFAULT_COLLECTION_QUERY);
  const handles = (sort: Parameters<typeof sortItems>[1]) =>
    sortItems(all, sort).map((i) => i.product.handle);

  it("sorts featured first, keeping merchandised order otherwise", () => {
    expect(handles("featured")).toEqual(["cup", "felt-desk-mat", "lamp"]);
  });

  it("sorts by price using matching variants", () => {
    expect(handles("price-asc")).toEqual(["cup", "felt-desk-mat", "lamp"]);
    expect(handles("price-desc")).toEqual(["lamp", "felt-desk-mat", "cup"]);
  });

  it("sorts newest first", () => {
    expect(handles("newest")).toEqual(["lamp", "cup", "felt-desk-mat"]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 30 }, (_, i) => i);

  it("slices pages and reports counts", () => {
    const page = paginate(items, 2, 12);
    expect(page.items).toEqual(items.slice(12, 24));
    expect(page.pageCount).toBe(3);
    expect(page.total).toBe(30);
  });

  it("clamps out-of-range pages", () => {
    expect(paginate(items, 99, 12).page).toBe(3);
    expect(paginate([], 5, 12)).toMatchObject({ page: 1, pageCount: 1, total: 0 });
  });
});

describe("optionFacets and queryCollection", () => {
  it("lists option values with product counts", () => {
    expect(facets.find((f) => f.name === "Color")?.values).toEqual([
      { value: "Charcoal", productCount: 1 },
      { value: "Oat", productCount: 2 },
    ]);
  });

  it("runs the full pipeline and reflects the clamped page", () => {
    const result = queryCollection(products, { sort: "newest", page: "7" });
    expect(result.query.page).toBe(1);
    expect(result.page.items.map((i) => i.product.handle)).toEqual([
      "lamp",
      "cup",
      "felt-desk-mat",
    ]);
    expect(hasActiveFilters(result.query)).toBe(false);
  });
});
