import { type Product, type Variant, type VariantOptions, variantAvailability } from "./catalog";
import { formatMoney } from "./money";

/**
 * Product-page rules: which variant is selected, which option values can be chosen,
 * and whether a quantity of a variant may be purchased. Pure functions only.
 */

/** Upper bound for a single cart line, independent of stock. */
export const MAX_QUANTITY_PER_LINE = 10;

function byPosition(variants: readonly Variant[]): Variant[] {
  return [...variants].sort((a, b) => a.position - b.position);
}

/** First in-stock variant by position, falling back to the first variant. */
export function defaultVariant(product: Pick<Product, "variants">): Variant | null {
  const sorted = byPosition(product.variants);
  return sorted.find((v) => v.inventoryQuantity > 0) ?? sorted[0] ?? null;
}

/**
 * Resolves `?variant=<id>` to one of the product's variants. Unknown or missing ids fall
 * back to the default variant, so stale or tampered links still show a valid page.
 */
export function resolveSelectedVariant(
  product: Pick<Product, "variants">,
  requestedId: string | undefined,
): Variant | null {
  if (requestedId) {
    const match = product.variants.find((v) => v.id === requestedId);
    if (match) return match;
  }
  return defaultVariant(product);
}

function sameOptionsExcept(a: VariantOptions, b: VariantOptions, except: string): boolean {
  return Object.keys(a).every((name) => name === except || a[name] === b[name]);
}

export interface OptionValueState {
  readonly value: string;
  readonly selected: boolean;
  /** Variant this choice leads to, keeping the other selected options when possible. */
  readonly variantId: string;
  /** False when that exact combination does not exist and another variant was substituted. */
  readonly exactMatch: boolean;
  readonly soldOut: boolean;
}

export interface OptionState {
  readonly name: string;
  readonly values: readonly OptionValueState[];
}

/**
 * For each option, the values a shopper can pick and where each leads. Choosing a value
 * keeps the other current selections when that combination exists; otherwise it moves to
 * the best variant with that value (in stock first).
 */
export function optionStates(product: Pick<Product, "variants">, selected: Variant): OptionState[] {
  const sorted = byPosition(product.variants);
  const names: string[] = [];
  for (const variant of sorted) {
    for (const name of Object.keys(variant.options)) if (!names.includes(name)) names.push(name);
  }

  return names
    .map((name) => {
      const values: string[] = [];
      for (const variant of sorted) {
        const value = variant.options[name];
        if (value !== undefined && !values.includes(value)) values.push(value);
      }
      return {
        name,
        values: values.map((value): OptionValueState => {
          const withValue = sorted.filter((v) => v.options[name] === value);
          const exact = withValue.find((v) => sameOptionsExcept(v.options, selected.options, name));
          const target =
            exact ?? withValue.find((v) => v.inventoryQuantity > 0) ?? (withValue[0] as Variant);
          return {
            value,
            selected: selected.options[name] === value,
            variantId: target.id,
            exactMatch: exact !== undefined,
            soldOut: target.inventoryQuantity <= 0,
          };
        }),
      };
    })
    .filter((option) => option.values.length > 1);
}

export interface PriceDisplay {
  readonly price: string;
  /** Present only when a compare-at price is genuinely higher than the price. */
  readonly compareAt: string | null;
}

export function priceDisplay(variant: Pick<Variant, "price" | "compareAtPrice">): PriceDisplay {
  const compareAt =
    variant.compareAtPrice &&
    variant.compareAtPrice.currency === variant.price.currency &&
    variant.compareAtPrice.amountMinor > variant.price.amountMinor
      ? formatMoney(variant.compareAtPrice)
      : null;
  return { price: formatMoney(variant.price), compareAt };
}

export function availabilityMessage(variant: Pick<Variant, "inventoryQuantity">): string {
  switch (variantAvailability(variant)) {
    case "sold_out":
      return "Sold out";
    case "low_stock":
      return `Only ${variant.inventoryQuantity} left in stock`;
    case "in_stock":
      return "In stock";
  }
}

/** Highest quantity a shopper may select for one line of this variant. */
export function maxPurchasableQuantity(variant: Pick<Variant, "inventoryQuantity">): number {
  return Math.max(0, Math.min(variant.inventoryQuantity, MAX_QUANTITY_PER_LINE));
}

export type PurchaseRejection =
  | "product_unavailable"
  | "variant_not_found"
  | "sold_out"
  | "invalid_quantity"
  | "insufficient_stock";

export type PurchaseCheck =
  | { readonly ok: true; readonly variant: Variant; readonly quantity: number }
  | { readonly ok: false; readonly reason: PurchaseRejection; readonly maxQuantity: number };

/**
 * Server-side guard for adding a variant to the cart. Never trust client input:
 * the variant must belong to an active product, be in stock, and the quantity must be
 * a whole number between 1 and the purchasable maximum.
 */
export function validatePurchase(
  product: Pick<Product, "status" | "variants">,
  variantId: string,
  quantity: number,
): PurchaseCheck {
  const variant = product.variants.find((v) => v.id === variantId);
  if (product.status !== "active") {
    return { ok: false, reason: "product_unavailable", maxQuantity: 0 };
  }
  if (!variant) return { ok: false, reason: "variant_not_found", maxQuantity: 0 };
  const max = maxPurchasableQuantity(variant);
  if (variant.inventoryQuantity <= 0) return { ok: false, reason: "sold_out", maxQuantity: 0 };
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return { ok: false, reason: "invalid_quantity", maxQuantity: max };
  }
  if (quantity > max) return { ok: false, reason: "insufficient_stock", maxQuantity: max };
  return { ok: true, variant, quantity };
}

/** Same-category products first (in stock before sold out), then others, excluding `product`. */
export function relatedProducts(
  product: Pick<Product, "id" | "categoryHandle">,
  candidates: readonly Product[],
  limit = 4,
): Product[] {
  const others = candidates.filter((c) => c.id !== product.id && c.status === "active");
  const inStock = (p: Product) => p.variants.some((v) => v.inventoryQuantity > 0);
  const rank = (p: Product) =>
    (p.categoryHandle === product.categoryHandle ? 0 : 2) + (inStock(p) ? 0 : 1);
  return others
    .map((p, index) => ({ p, index }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.index - b.index)
    .slice(0, limit)
    .map(({ p }) => p);
}
