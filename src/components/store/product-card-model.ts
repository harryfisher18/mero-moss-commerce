import {
  optionMatrix,
  priceRange,
  type Product,
  type Variant,
  productAvailability,
} from "@/domain/commerce/catalog";
import { formatMoney } from "@/domain/commerce/money";

export interface ProductCardModel {
  /** Product page URL; deep-links to a matching variant when filters narrowed the choice. */
  readonly href: string;
  readonly title: string;
  readonly summary: string;
  readonly priceLabel: string;
  readonly availabilityLabel: string | null;
  readonly soldOut: boolean;
  readonly optionsLabel: string | null;
}

function pluralize(count: number, noun: string): string {
  const lower = noun.toLowerCase();
  if (count === 1) return `1 ${lower}`;
  return `${count} ${lower.endsWith("s") ? lower : `${lower}s`}`;
}

/**
 * Derives everything a product card displays from catalog data only.
 * `priceVariants` narrows the displayed price to variants matching active filters.
 */
export function toProductCardModel(
  product: Product,
  priceVariants: readonly Variant[] = product.variants,
): ProductCardModel {
  const range = priceRange({
    variants: priceVariants.length > 0 ? priceVariants : product.variants,
  });
  const priceLabel =
    range.min.amountMinor === range.max.amountMinor
      ? formatMoney(range.min)
      : `From ${formatMoney(range.min)}`;

  const availability = productAvailability(product);
  const availabilityLabel =
    availability === "sold_out" ? "Sold out" : availability === "low_stock" ? "Low stock" : null;

  const options = optionMatrix(product).filter((option) => option.values.length > 1);
  const optionsLabel =
    options.length > 0
      ? options.map((option) => pluralize(option.values.length, option.name)).join(" · ")
      : null;

  const narrowed = priceVariants.length > 0 && priceVariants.length < product.variants.length;
  const linkVariant = narrowed
    ? (priceVariants.find((variant) => variant.inventoryQuantity > 0) ?? priceVariants[0])
    : undefined;
  const href = `/products/${product.handle}${
    linkVariant ? `?variant=${encodeURIComponent(linkVariant.id)}` : ""
  }`;

  return {
    href,
    title: product.title,
    summary: product.summary,
    priceLabel,
    availabilityLabel,
    soldOut: availability === "sold_out",
    optionsLabel,
  };
}
