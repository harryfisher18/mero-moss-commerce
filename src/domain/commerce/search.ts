import { tokenize } from "@/domain/advisor/query";
import { CATEGORY_DEFINITIONS, type Product } from "./catalog";

/**
 * Storefront keyword search. Pure. Every word in the query must match the start of a word
 * somewhere in the product, so "lin bin" finds "Linen Storage Bin". Matches in the title
 * rank highest. Only active products are searched.
 */

export const MAX_SEARCH_LENGTH = 100;

const WEIGHTS = { title: 3, facets: 2, body: 1 } as const;

export function normalizeSearch(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_LENGTH) : "";
}

function fields(product: Product) {
  const options = product.variants.flatMap((variant) => Object.values(variant.options));
  return {
    title: tokenize(product.title),
    facets: tokenize(
      [...product.tags, CATEGORY_DEFINITIONS[product.categoryHandle].title, ...options].join(" "),
    ),
    body: tokenize(`${product.summary} ${product.materials}`),
  };
}

/** Score for one product, or 0 when any query word is missing from it. */
export function searchScore(product: Product, terms: readonly string[]): number {
  if (terms.length === 0) return 0;
  const words = fields(product);
  let score = 0;
  for (const term of terms) {
    const best = Math.max(
      ...(Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((field) =>
        words[field].some((word) => word.startsWith(term)) ? WEIGHTS[field] : 0,
      ),
    );
    if (best === 0) return 0;
    score += best;
  }
  return score;
}

export function searchProducts(query: string, products: readonly Product[]): Product[] {
  const terms = [...new Set(tokenize(normalizeSearch(query)))];
  return products
    .filter((product) => product.status === "active")
    .map((product) => ({ product, score: searchScore(product, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title))
    .map((entry) => entry.product);
}
