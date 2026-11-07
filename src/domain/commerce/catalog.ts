import type { Money } from "./money";

/**
 * Pure catalog types and rules. No I/O lives here.
 */

export const CATEGORY_HANDLES = [
  "home-organization",
  "table-and-kitchen",
  "workspace",
  "travel-essentials",
] as const;
export type CategoryHandle = (typeof CATEGORY_HANDLES)[number];

/** Canonical category definitions shared by seed data, routing and page metadata. */
export const CATEGORY_DEFINITIONS: Readonly<
  Record<CategoryHandle, { readonly title: string; readonly description: string }>
> = {
  "home-organization": {
    title: "Home Organization",
    description: "Baskets, bins and hooks that give everyday things a calm place to land.",
  },
  "table-and-kitchen": {
    title: "Table & Kitchen",
    description: "Stoneware, linen and wood for daily meals and slow weekends.",
  },
  workspace: {
    title: "Workspace",
    description: "Considered desk pieces that keep focus close and clutter out of sight.",
  },
  "travel-essentials": {
    title: "Travel Essentials",
    description: "Hard-wearing companions for weekends away and long journeys.",
  },
};

export interface Category {
  readonly id: string;
  readonly handle: CategoryHandle;
  readonly title: string;
  readonly description: string;
  readonly position: number;
}

export type ProductStatus = "active" | "draft" | "archived";

/** Option name → selected value, e.g. { Color: "Oat", Size: "Large" }. */
export type VariantOptions = Readonly<Record<string, string>>;

export interface Variant {
  readonly id: string;
  readonly productId: string;
  readonly sku: string;
  readonly title: string;
  readonly options: VariantOptions;
  readonly price: Money;
  readonly compareAtPrice: Money | null;
  readonly inventoryQuantity: number;
  readonly position: number;
}

export interface Product {
  readonly id: string;
  readonly handle: string;
  readonly title: string;
  readonly categoryHandle: CategoryHandle;
  readonly summary: string;
  readonly description: string;
  readonly materials: string;
  readonly care: string;
  readonly tags: readonly string[];
  readonly status: ProductStatus;
  readonly featured: boolean;
  /** Primary swatch color (hex) used for product artwork until photography exists. */
  readonly swatch: string;
  /** Search result / meta description. Empty means "use the summary". */
  readonly seoDescription: string;
  readonly variants: readonly Variant[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PriceRange {
  readonly min: Money;
  readonly max: Money;
}

export type Availability = "in_stock" | "low_stock" | "sold_out";

export const LOW_STOCK_THRESHOLD = 5;

export function variantAvailability(variant: Pick<Variant, "inventoryQuantity">): Availability {
  if (variant.inventoryQuantity <= 0) return "sold_out";
  if (variant.inventoryQuantity <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}

export function productAvailability(product: Pick<Product, "variants">): Availability {
  const total = totalInventory(product);
  if (total <= 0) return "sold_out";
  const anyHealthy = product.variants.some((v) => variantAvailability(v) === "in_stock");
  return anyHealthy ? "in_stock" : "low_stock";
}

export function totalInventory(product: Pick<Product, "variants">): number {
  return product.variants.reduce((sum, v) => sum + Math.max(0, v.inventoryQuantity), 0);
}

export function priceRange(product: Pick<Product, "variants">): PriceRange {
  const [first, ...rest] = product.variants;
  if (!first) {
    throw new Error("A product must have at least one variant to compute a price range");
  }
  let min = first.price;
  let max = first.price;
  for (const variant of rest) {
    if (variant.price.currency !== first.price.currency) {
      throw new Error("All variants of a product must share one currency");
    }
    if (variant.price.amountMinor < min.amountMinor) min = variant.price;
    if (variant.price.amountMinor > max.amountMinor) max = variant.price;
  }
  return { min, max };
}

export function isPurchasable(product: Pick<Product, "status">, variant: Variant): boolean {
  return product.status === "active" && variant.inventoryQuantity > 0;
}

/** Ordered option names with their distinct values, in variant position order. */
export function optionMatrix(product: Pick<Product, "variants">): Array<{
  name: string;
  values: string[];
}> {
  const matrix = new Map<string, string[]>();
  const sorted = [...product.variants].sort((a, b) => a.position - b.position);
  for (const variant of sorted) {
    for (const [name, value] of Object.entries(variant.options)) {
      const values = matrix.get(name) ?? [];
      if (!values.includes(value)) values.push(value);
      matrix.set(name, values);
    }
  }
  return [...matrix.entries()].map(([name, values]) => ({ name, values }));
}

export function isCategoryHandle(value: string): value is CategoryHandle {
  return (CATEGORY_HANDLES as readonly string[]).includes(value);
}
