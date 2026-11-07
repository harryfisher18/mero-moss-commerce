import { CATEGORY_DEFINITIONS, type Product, type Variant } from "@/domain/commerce/catalog";
import { formatMoney, money } from "@/domain/commerce/money";
import { type ShopperIntent, tokenize } from "./query";

/**
 * Deterministic retrieval: hard constraints (active, in stock, budget, category, options)
 * filter the catalog; keyword overlap only ranks. Every match carries the exact variant a
 * shopper would buy, so prices and stock in answers come straight from catalog rows.
 */

export interface Match {
  readonly product: Product;
  readonly variant: Variant;
  readonly score: number;
  readonly reasons: readonly string[];
}

/** Something the shopper asked for that exists but cannot be bought right now. */
export interface Unavailable {
  readonly product: Product;
  readonly variantTitle: string | null;
}

export interface Retrieval {
  readonly matches: readonly Match[];
  readonly unavailable: readonly Unavailable[];
  /** True when keywords matched nothing, so only the other constraints were applied. */
  readonly relaxed: boolean;
}

export const MAX_MATCHES = 4;

/** Words the catalog itself uses, so the parser can recognize option values. */
export function catalogVocabulary(products: readonly Product[]): { optionValues: string[] } {
  const values = new Set<string>();
  for (const product of products) {
    for (const variant of product.variants) {
      for (const value of Object.values(variant.options)) values.add(value);
    }
  }
  return { optionValues: [...values].sort() };
}

export function keywordScore(product: Product, keywords: readonly string[]): number {
  if (keywords.length === 0) return 0;
  const title = new Set(tokenize(product.title));
  const tags = new Set(product.tags.flatMap((tag) => tokenize(tag)));
  const body = new Set(tokenize(`${product.summary} ${product.materials}`));
  let score = 0;
  for (const keyword of keywords) {
    if (title.has(keyword)) score += 3;
    else if (tags.has(keyword)) score += 2;
    else if (body.has(keyword)) score += 1;
  }
  return score;
}

function hasOptions(variant: Variant, optionValues: readonly string[]): boolean {
  const values = Object.values(variant.options).map((v) => v.toLowerCase());
  return optionValues.every((wanted) => values.includes(wanted.toLowerCase()));
}

function inBudget(variant: Variant, intent: ShopperIntent): boolean {
  const amount = variant.price.amountMinor;
  return (
    (intent.minPriceMinor === null || amount >= intent.minPriceMinor) &&
    (intent.maxPriceMinor === null || amount <= intent.maxPriceMinor)
  );
}

const isOnSale = (variant: Variant) =>
  variant.compareAtPrice !== null && variant.compareAtPrice.amountMinor > variant.price.amountMinor;

export function variantLabel(product: Product, variant: Variant): string | null {
  return product.variants.length > 1 ? variant.title : null;
}

function reasonsFor(intent: ShopperIntent, product: Product, variant: Variant): string[] {
  const reasons = ["In stock"];
  const usd = (minor: number) => formatMoney(money(minor, variant.price.currency));
  if (intent.maxPriceMinor !== null && intent.minPriceMinor !== null) {
    reasons.push(`Between ${usd(intent.minPriceMinor)} and ${usd(intent.maxPriceMinor)}`);
  } else if (intent.maxPriceMinor !== null) {
    reasons.push(`Under ${usd(intent.maxPriceMinor)}`);
  } else if (intent.minPriceMinor !== null) {
    reasons.push(`Over ${usd(intent.minPriceMinor)}`);
  }
  if (intent.category) reasons.push(`In ${CATEGORY_DEFINITIONS[product.categoryHandle].title}`);
  if (intent.optionValues.length > 0)
    reasons.push(`Available in ${intent.optionValues.join(", ")}`);
  if (isOnSale(variant)) reasons.push("On sale");
  return reasons;
}

function search(
  intent: ShopperIntent,
  products: readonly Product[],
  useKeywords: boolean,
): { matches: Match[]; unavailable: Unavailable[] } {
  const matches: Match[] = [];
  const unavailable: Unavailable[] = [];
  for (const product of products) {
    if (product.status !== "active") continue;
    if (intent.category && product.categoryHandle !== intent.category) continue;
    const score = keywordScore(product, intent.keywords);
    if (useKeywords && intent.keywords.length > 0 && score === 0) continue;

    const wanted = product.variants.filter(
      (v) =>
        hasOptions(v, intent.optionValues) &&
        inBudget(v, intent) &&
        (!intent.saleOnly || isOnSale(v)),
    );
    if (wanted.length === 0) continue;
    const buyable = wanted.filter((v) => v.inventoryQuantity > 0);
    if (buyable.length === 0) {
      // Only report sold-out items the shopper actually asked about.
      if (score > 0 || intent.optionValues.length > 0) {
        const first = wanted[0];
        unavailable.push({
          product,
          variantTitle:
            first && intent.optionValues.length > 0 ? variantLabel(product, first) : null,
        });
      }
      continue;
    }
    const ordered = [...buyable].sort(
      (a, b) =>
        (intent.wantsSale ? Number(isOnSale(b)) - Number(isOnSale(a)) : 0) ||
        a.price.amountMinor - b.price.amountMinor ||
        a.position - b.position,
    );
    const variant = ordered[0];
    if (!variant) continue;
    matches.push({
      product,
      variant,
      score: score + (intent.wantsSale && isOnSale(variant) ? 3 : 0),
      reasons: reasonsFor(intent, product, variant),
    });
  }
  matches.sort(
    (a, b) =>
      (intent.cheapestFirst ? a.variant.price.amountMinor - b.variant.price.amountMinor : 0) ||
      b.score - a.score ||
      a.variant.price.amountMinor - b.variant.price.amountMinor ||
      a.product.title.localeCompare(b.product.title),
  );
  // When keywords clearly point at specific products, drop weak partial matches.
  const top = Math.max(0, ...matches.map((m) => m.score));
  const relevant =
    useKeywords && intent.keywords.length > 0 ? matches.filter((m) => m.score * 2 >= top) : matches;
  return { matches: relevant, unavailable };
}

export function retrieve(
  intent: ShopperIntent,
  products: readonly Product[],
  limit = MAX_MATCHES,
): Retrieval {
  if (intent.kind === "compare") return compare(intent, products);
  if (intent.vague) return { matches: [], unavailable: [], relaxed: false };
  const strict = search(intent, products, true);
  const hasOtherConstraints =
    intent.category !== null ||
    intent.optionValues.length > 0 ||
    intent.maxPriceMinor !== null ||
    intent.minPriceMinor !== null;
  if (strict.matches.length === 0 && intent.keywords.length > 0 && hasOtherConstraints) {
    const relaxed = search(intent, products, false);
    return {
      matches: relaxed.matches.slice(0, limit),
      unavailable: strict.unavailable,
      relaxed: relaxed.matches.length > 0,
    };
  }
  return {
    matches: strict.matches.slice(0, limit),
    unavailable: strict.unavailable,
    relaxed: false,
  };
}

/** For "compare A and B": the best title match for each phrase, one per product. */
function compare(intent: ShopperIntent, products: readonly Product[]): Retrieval {
  const matches: Match[] = [];
  const unavailable: Unavailable[] = [];
  const used = new Set<string>();
  for (const terms of intent.compareTerms.slice(0, 3)) {
    let best: { product: Product; score: number } | null = null;
    for (const product of products) {
      if (product.status !== "active" || used.has(product.id)) continue;
      const score = keywordScore(product, terms);
      if (score > 0 && (!best || score > best.score)) best = { product, score };
    }
    if (!best) continue;
    used.add(best.product.id);
    const buyable = best.product.variants
      .filter((v) => v.inventoryQuantity > 0)
      .sort((a, b) => a.price.amountMinor - b.price.amountMinor);
    const variant = buyable[0];
    if (!variant) {
      unavailable.push({ product: best.product, variantTitle: null });
      continue;
    }
    matches.push({
      product: best.product,
      variant,
      score: best.score,
      reasons: [
        "In stock",
        `In ${CATEGORY_DEFINITIONS[best.product.categoryHandle].title}`,
        ...(isOnSale(variant) ? ["On sale"] : []),
      ],
    });
  }
  return { matches, unavailable, relaxed: false };
}
