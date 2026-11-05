import { z } from "zod";
import type { Product, Variant } from "./catalog";

/**
 * Collection browsing rules: URL state, filtering, facets, sorting and pagination.
 * Pure functions only; the URL is the single source of truth for collection state.
 */

export const SORT_KEYS = ["featured", "price-asc", "price-desc", "newest"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_LABELS: Readonly<Record<SortKey, string>> = {
  featured: "Featured",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  newest: "Newest",
};

/** Price bands in USD minor units; `max` is exclusive. */
export const PRICE_BANDS = {
  "under-25": { label: "Under $25", min: 0, max: 2500 },
  "25-50": { label: "$25 – $50", min: 2500, max: 5000 },
  "50-100": { label: "$50 – $100", min: 5000, max: 10000 },
  "100-plus": { label: "$100 and over", min: 10000, max: Number.POSITIVE_INFINITY },
} as const;
export type PriceBandKey = keyof typeof PRICE_BANDS;
const PRICE_BAND_KEYS = Object.keys(PRICE_BANDS) as [PriceBandKey, ...PriceBandKey[]];

export const PAGE_SIZE = 12;
const MAX_OPTION_VALUES = 20;
const RESERVED_PARAMS = new Set(["sort", "availability", "price", "page"]);

export interface CollectionQuery {
  readonly sort: SortKey;
  readonly inStockOnly: boolean;
  readonly price: PriceBandKey | null;
  /** Option name (as stored, e.g. "Color") → accepted values. Empty arrays never appear. */
  readonly options: Readonly<Record<string, readonly string[]>>;
  readonly page: number;
}

export const DEFAULT_COLLECTION_QUERY: CollectionQuery = {
  sort: "featured",
  inStockOnly: false,
  price: null,
  options: {},
  page: 1,
};

export type RawSearchParams = Readonly<Record<string, string | string[] | undefined>>;

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;
const allValues = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const sortSchema = z.enum(SORT_KEYS).catch("featured");
const priceSchema = z.enum(PRICE_BAND_KEYS).nullable().catch(null);
const pageSchema = z.coerce.number().int().min(1).max(10_000).catch(1);

/** Option names are exposed in URLs as lowercase keys, e.g. "Color" → "color". */
export function optionParamKey(optionName: string): string {
  return optionName.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Parses untrusted URL params. Anything invalid falls back to the default instead of
 * erroring. Option filters are only accepted for option names that exist in `facets`,
 * and only with values that exist for that option.
 */
export function parseCollectionQuery(
  params: RawSearchParams,
  facets: readonly OptionFacet[],
): CollectionQuery {
  const options: Record<string, string[]> = {};
  for (const facet of facets) {
    const key = optionParamKey(facet.name);
    if (RESERVED_PARAMS.has(key)) continue;
    const known = new Map(facet.values.map((v) => [v.value.toLowerCase(), v.value]));
    const accepted = [
      ...new Set(
        allValues(params[key])
          .slice(0, MAX_OPTION_VALUES)
          .map((v) => known.get(v.toLowerCase()))
          .filter((v): v is string => v !== undefined),
      ),
    ];
    if (accepted.length > 0) options[facet.name] = accepted;
  }

  return {
    sort: sortSchema.parse(firstValue(params.sort)),
    inStockOnly: firstValue(params.availability) === "in-stock",
    price: priceSchema.parse(firstValue(params.price) ?? null),
    options,
    page: pageSchema.parse(firstValue(params.page) ?? 1),
  };
}

/** Serializes a query to a stable, minimal query string (defaults omitted). */
export function serializeCollectionQuery(query: CollectionQuery): string {
  const params = new URLSearchParams();
  if (query.inStockOnly) params.set("availability", "in-stock");
  if (query.price) params.set("price", query.price);
  for (const name of Object.keys(query.options).sort()) {
    for (const value of [...(query.options[name] ?? [])].sort()) {
      params.append(optionParamKey(name), value);
    }
  }
  if (query.sort !== "featured") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function hasActiveFilters(query: CollectionQuery): boolean {
  return query.inStockOnly || query.price !== null || Object.keys(query.options).length > 0;
}

function variantMatches(variant: Variant, query: CollectionQuery): boolean {
  if (query.inStockOnly && variant.inventoryQuantity <= 0) return false;
  if (query.price) {
    const band = PRICE_BANDS[query.price];
    if (variant.price.amountMinor < band.min || variant.price.amountMinor >= band.max) return false;
  }
  for (const [name, values] of Object.entries(query.options)) {
    const value = variant.options[name];
    if (value === undefined || !values.includes(value)) return false;
  }
  return true;
}

/** Variants of `product` that satisfy every variant-level filter at the same time. */
export function matchingVariants(product: Product, query: CollectionQuery): Variant[] {
  return product.variants.filter((variant) => variantMatches(variant, query));
}

export interface CollectionItem {
  readonly product: Product;
  /** Variants matching the active filters; drives the displayed price for sorting. */
  readonly matches: readonly Variant[];
}

function minPrice(variants: readonly Variant[]): number {
  return Math.min(...variants.map((v) => v.price.amountMinor));
}
function maxPrice(variants: readonly Variant[]): number {
  return Math.max(...variants.map((v) => v.price.amountMinor));
}

export function filterProducts(
  products: readonly Product[],
  query: CollectionQuery,
): CollectionItem[] {
  const items: CollectionItem[] = [];
  for (const product of products) {
    const matches = matchingVariants(product, query);
    if (matches.length > 0) items.push({ product, matches });
  }
  return items;
}

/** Stable sort; `products` are expected in the repository's default (merchandised) order. */
export function sortItems(items: readonly CollectionItem[], sort: SortKey): CollectionItem[] {
  const indexed = items.map((item, index) => ({ item, index }));
  const byIndex = (a: { index: number }, b: { index: number }) => a.index - b.index;
  const compare: Record<
    SortKey,
    (
      a: { item: CollectionItem; index: number },
      b: { item: CollectionItem; index: number },
    ) => number
  > = {
    featured: (a, b) =>
      Number(b.item.product.featured) - Number(a.item.product.featured) || byIndex(a, b),
    "price-asc": (a, b) => minPrice(a.item.matches) - minPrice(b.item.matches) || byIndex(a, b),
    "price-desc": (a, b) => maxPrice(b.item.matches) - maxPrice(a.item.matches) || byIndex(a, b),
    newest: (a, b) =>
      b.item.product.createdAt.localeCompare(a.item.product.createdAt) || byIndex(a, b),
  };
  return indexed.sort(compare[sort]).map(({ item }) => item);
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
  readonly pageSize: number;
}

/** Clamps out-of-range pages to the last page so stale links still show results. */
export function paginate<T>(items: readonly T[], page: number, pageSize = PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, Math.trunc(page)), pageCount);
  const start = (current - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: current,
    pageCount,
    total: items.length,
    pageSize,
  };
}

export interface OptionFacet {
  readonly name: string;
  readonly values: ReadonlyArray<{ readonly value: string; readonly productCount: number }>;
}

/** Option names and values available across `products`, with product counts. */
export function optionFacets(products: readonly Product[]): OptionFacet[] {
  const facets = new Map<string, Map<string, Set<string>>>();
  for (const product of products) {
    for (const variant of product.variants) {
      for (const [name, value] of Object.entries(variant.options)) {
        const values = facets.get(name) ?? new Map<string, Set<string>>();
        const productIds = values.get(value) ?? new Set<string>();
        productIds.add(product.id);
        values.set(value, productIds);
        facets.set(name, values);
      }
    }
  }
  return [...facets.entries()]
    .map(([name, values]) => ({
      name,
      values: [...values.entries()]
        .map(([value, ids]) => ({ value, productCount: ids.size }))
        .sort((a, b) => a.value.localeCompare(b.value)),
    }))
    .filter((facet) => !RESERVED_PARAMS.has(optionParamKey(facet.name)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface CollectionResult {
  readonly query: CollectionQuery;
  readonly facets: readonly OptionFacet[];
  readonly page: Page<CollectionItem>;
}

/** Full pipeline from raw URL params to the page of products to render. */
export function queryCollection(
  products: readonly Product[],
  params: RawSearchParams,
): CollectionResult {
  const facets = optionFacets(products);
  const parsed = parseCollectionQuery(params, facets);
  const sorted = sortItems(filterProducts(products, parsed), parsed.sort);
  const page = paginate(sorted, parsed.page);
  return { query: { ...parsed, page: page.page }, facets, page };
}
