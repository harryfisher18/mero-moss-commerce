import type { Product, Variant } from "./catalog";
import { type CurrencyCode, type Money, money, multiplyMoney, sumMoney, zero } from "./money";
import {
  maxPurchasableQuantity,
  type PurchaseRejection,
  validatePurchase,
} from "./variant-selection";

/**
 * Cart rules. A cart stores only variant ids and quantities; prices, stock and names are
 * always re-read from the catalog, so nothing the browser sends is trusted.
 */

export const MAX_CART_LINES = 20;

export interface CartLine {
  readonly variantId: string;
  readonly quantity: number;
}

export interface CatalogEntry {
  readonly product: Product;
  readonly variant: Variant;
}

export type CartRejection = PurchaseRejection | "cart_full" | "line_not_found";

export type CartMutation =
  | { readonly ok: true; readonly lines: readonly CartLine[] }
  | { readonly ok: false; readonly reason: CartRejection; readonly maxQuantity: number };

function reject(reason: CartRejection, maxQuantity = 0): CartMutation {
  return { ok: false, reason, maxQuantity };
}

/** Adds `quantity` to the line for `variantId`; the combined quantity must be purchasable. */
export function addLine(
  lines: readonly CartLine[],
  entry: CatalogEntry | undefined,
  variantId: string,
  quantity: number,
): CartMutation {
  if (!entry) return reject("variant_not_found");
  const existing = lines.find((line) => line.variantId === variantId);
  if (!existing && lines.length >= MAX_CART_LINES) return reject("cart_full");
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return reject("invalid_quantity", maxPurchasableQuantity(entry.variant));
  }
  const combined = (existing?.quantity ?? 0) + quantity;
  const check = validatePurchase(entry.product, variantId, combined);
  if (!check.ok) {
    // Report how many more can still be added, not the absolute maximum.
    const remaining = Math.max(0, check.maxQuantity - (existing?.quantity ?? 0));
    return reject(check.reason, remaining);
  }
  const next = existing
    ? lines.map((line) => (line.variantId === variantId ? { variantId, quantity: combined } : line))
    : [...lines, { variantId, quantity }];
  return { ok: true, lines: next };
}

/** Sets an existing line's quantity; 0 removes the line. */
export function setLineQuantity(
  lines: readonly CartLine[],
  entry: CatalogEntry | undefined,
  variantId: string,
  quantity: number,
): CartMutation {
  if (!lines.some((line) => line.variantId === variantId)) return reject("line_not_found");
  if (quantity === 0) return removeLine(lines, variantId);
  if (!entry) return reject("variant_not_found");
  const check = validatePurchase(entry.product, variantId, quantity);
  if (!check.ok) return reject(check.reason, check.maxQuantity);
  return {
    ok: true,
    lines: lines.map((line) => (line.variantId === variantId ? { variantId, quantity } : line)),
  };
}

export function removeLine(lines: readonly CartLine[], variantId: string): CartMutation {
  if (!lines.some((line) => line.variantId === variantId)) return reject("line_not_found");
  return { ok: true, lines: lines.filter((line) => line.variantId !== variantId) };
}

export type LineIssue = "unavailable" | "sold_out" | "quantity_reduced";

export interface PricedLine {
  readonly variantId: string;
  readonly productHandle: string | null;
  readonly productTitle: string;
  readonly variantTitle: string | null;
  readonly sku: string | null;
  readonly unitPrice: Money | null;
  /** Quantity the shopper asked for. */
  readonly requestedQuantity: number;
  /** Quantity that can actually be bought now (counts toward totals). */
  readonly quantity: number;
  readonly maxQuantity: number;
  readonly lineTotal: Money | null;
  readonly issue: LineIssue | null;
}

/**
 * Shipping estimate. These numbers must match the stored shipping policy text
 * (a test checks the seeded policy), so the cart never makes a promise the policy doesn't.
 */
export const SHIPPING_RULE = { freeThresholdMinor: 7500, flatRateMinor: 800 } as const;

export interface CartTotals {
  readonly currency: CurrencyCode;
  readonly itemCount: number;
  readonly subtotal: Money;
  readonly shippingEstimate: Money;
  readonly estimatedTotal: Money;
  readonly freeShippingRemaining: Money | null;
}

export interface PricedCart {
  readonly lines: readonly PricedLine[];
  readonly totals: CartTotals;
  readonly hasIssues: boolean;
}

export function priceLine(line: CartLine, entry: CatalogEntry | undefined): PricedLine {
  if (!entry || entry.product.status !== "active") {
    return {
      variantId: line.variantId,
      productHandle: entry?.product.handle ?? null,
      productTitle: entry?.product.title ?? "Item no longer available",
      variantTitle: entry?.variant.title ?? null,
      sku: entry?.variant.sku ?? null,
      unitPrice: null,
      requestedQuantity: line.quantity,
      quantity: 0,
      maxQuantity: 0,
      lineTotal: null,
      issue: "unavailable",
    };
  }
  const max = maxPurchasableQuantity(entry.variant);
  const quantity = Math.min(line.quantity, max);
  const issue: LineIssue | null =
    max === 0 ? "sold_out" : quantity < line.quantity ? "quantity_reduced" : null;
  return {
    variantId: line.variantId,
    productHandle: entry.product.handle,
    productTitle: entry.product.title,
    variantTitle: entry.variant.title === "Default" ? null : entry.variant.title,
    sku: entry.variant.sku,
    unitPrice: entry.variant.price,
    requestedQuantity: line.quantity,
    quantity,
    maxQuantity: max,
    lineTotal: multiplyMoney(entry.variant.price, quantity),
    issue,
  };
}

export function priceCart(
  lines: readonly CartLine[],
  catalog: ReadonlyMap<string, CatalogEntry>,
  currency: CurrencyCode = "USD",
): PricedCart {
  const priced = lines.map((line) => priceLine(line, catalog.get(line.variantId)));
  const counted = priced.filter((line) => line.lineTotal !== null && line.quantity > 0);
  const subtotal = sumMoney(
    counted.map((line) => line.lineTotal as Money),
    currency,
  );
  const itemCount = counted.reduce((sum, line) => sum + line.quantity, 0);
  const free = subtotal.amountMinor >= SHIPPING_RULE.freeThresholdMinor;
  const shippingEstimate =
    itemCount === 0 || free ? zero(currency) : money(SHIPPING_RULE.flatRateMinor, currency);
  return {
    lines: priced,
    hasIssues: priced.some((line) => line.issue !== null),
    totals: {
      currency,
      itemCount,
      subtotal,
      shippingEstimate,
      estimatedTotal: money(subtotal.amountMinor + shippingEstimate.amountMinor, currency),
      freeShippingRemaining:
        itemCount > 0 && !free
          ? money(SHIPPING_RULE.freeThresholdMinor - subtotal.amountMinor, currency)
          : null,
    },
  };
}

/** Total units in the cart, as shown in the header (requested quantities). */
export function cartItemCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function rejectionMessage(
  reason: CartRejection,
  maxQuantity: number,
  context: "add" | "update" = "add",
): string {
  switch (reason) {
    case "sold_out":
      return "Sorry, this item just sold out.";
    case "insufficient_stock":
      if (context === "update") return `Only ${maxQuantity} available. Please choose fewer.`;
      return maxQuantity > 0
        ? `Only ${maxQuantity} more can be added to your cart.`
        : "You already have all available stock of this item in your cart.";
    case "invalid_quantity":
      return "Please choose a quantity of at least 1.";
    case "product_unavailable":
    case "variant_not_found":
      return "This item is no longer available.";
    case "cart_full":
      return `Your cart can hold up to ${MAX_CART_LINES} different items.`;
    case "line_not_found":
      return "That item is no longer in your cart.";
  }
}
