import { z } from "zod";
import { type CartLine, type CatalogEntry, priceCart } from "./cart";
import { type CurrencyCode, type Money, multiplyMoney } from "./money";
import { maxPurchasableQuantity } from "./variant-selection";

/**
 * Checkout and order rules for the DEMO store. Orders are always simulated: no payment
 * is taken and nothing ships. Pure functions only.
 */

/** Contiguous US states plus DC, matching the stored shipping policy. */
export const SHIPPING_REGIONS = {
  AL: "Alabama",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
} as const;
export type RegionCode = keyof typeof SHIPPING_REGIONS;
const REGION_CODES = Object.keys(SHIPPING_REGIONS) as [RegionCode, ...RegionCode[]];

const text = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const checkoutDetailsSchema = z.object({
  email: z
    .string({ error: "Email is required." })
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.").max(254)),
  fullName: text("Full name", 100),
  address1: text("Address", 120),
  address2: z.string().trim().max(120, "Address line 2 must be 120 characters or fewer."),
  city: text("City", 80),
  region: z.enum(REGION_CODES, { error: "Choose a state." }),
  postalCode: z
    .string({ error: "ZIP code is required." })
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code (or ZIP+4)."),
  acknowledgeSimulated: z.literal("yes", {
    error: "Please confirm you understand this is a simulated order.",
  }),
});

export type CheckoutDetails = z.infer<typeof checkoutDetailsSchema>;
export type CheckoutField = keyof CheckoutDetails;

export type CheckoutProblemReason = "unavailable" | "sold_out" | "insufficient_stock";

export interface CheckoutProblem {
  readonly variantId: string;
  readonly productTitle: string;
  readonly reason: CheckoutProblemReason;
  readonly available: number;
}

export interface OrderDraftLine {
  readonly variantId: string;
  readonly productId: string;
  readonly sku: string;
  readonly productTitle: string;
  readonly variantTitle: string | null;
  readonly unitPrice: Money;
  readonly quantity: number;
  readonly lineTotal: Money;
}

export interface OrderDraft {
  readonly currency: CurrencyCode;
  readonly lines: readonly OrderDraftLine[];
  readonly subtotal: Money;
  readonly shipping: Money;
  readonly total: Money;
  readonly itemCount: number;
}

export type OrderDraftResult =
  | { readonly ok: true; readonly draft: OrderDraft }
  | { readonly ok: false; readonly reason: "empty_cart" }
  | { readonly ok: false; readonly reason: "problems"; readonly problems: CheckoutProblem[] };

/**
 * Builds an order from cart lines and the current catalog. Unlike the cart view, which
 * caps quantities for display, checkout rejects any line that cannot be fulfilled exactly
 * as requested, so the shopper never gets an order different from what they reviewed.
 */
export function buildOrderDraft(
  lines: readonly CartLine[],
  catalog: ReadonlyMap<string, CatalogEntry>,
  currency: CurrencyCode = "USD",
): OrderDraftResult {
  if (lines.length === 0) return { ok: false, reason: "empty_cart" };

  const problems: CheckoutProblem[] = [];
  const draftLines: OrderDraftLine[] = [];
  for (const line of lines) {
    const entry = catalog.get(line.variantId);
    if (!entry || entry.product.status !== "active") {
      problems.push({
        variantId: line.variantId,
        productTitle: entry?.product.title ?? "An item in your cart",
        reason: "unavailable",
        available: 0,
      });
      continue;
    }
    const available = maxPurchasableQuantity(entry.variant);
    if (available === 0 || line.quantity > available) {
      problems.push({
        variantId: line.variantId,
        productTitle: entry.product.title,
        reason: available === 0 ? "sold_out" : "insufficient_stock",
        available,
      });
      continue;
    }
    draftLines.push({
      variantId: entry.variant.id,
      productId: entry.product.id,
      sku: entry.variant.sku,
      productTitle: entry.product.title,
      variantTitle: entry.variant.title === "Default" ? null : entry.variant.title,
      unitPrice: entry.variant.price,
      quantity: line.quantity,
      lineTotal: multiplyMoney(entry.variant.price, line.quantity),
    });
  }
  if (problems.length > 0) return { ok: false, reason: "problems", problems };

  const { totals } = priceCart(lines, catalog, currency);
  return {
    ok: true,
    draft: {
      currency,
      lines: draftLines,
      subtotal: totals.subtotal,
      shipping: totals.shippingEstimate,
      total: totals.estimatedTotal,
      itemCount: totals.itemCount,
    },
  };
}

export function problemMessage(problem: CheckoutProblem): string {
  switch (problem.reason) {
    case "unavailable":
      return `${problem.productTitle} is no longer available.`;
    case "sold_out":
      return `${problem.productTitle} has sold out.`;
    case "insufficient_stock":
      return `Only ${problem.available} of ${problem.productTitle} ${
        problem.available === 1 ? "is" : "are"
      } available.`;
  }
}

/** Human-readable order number from a monotonically increasing sequence. */
export function formatOrderNumber(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error(`Invalid order sequence ${sequence}`);
  }
  return `MM-${String(100000 + sequence)}`;
}

export const ORDER_STATUSES = ["placed", "processing", "fulfilled", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface ShippingAddress {
  readonly fullName: string;
  readonly address1: string;
  readonly address2: string;
  readonly city: string;
  readonly region: RegionCode;
  readonly postalCode: string;
  readonly country: "US";
}

/** A persisted order. `isSimulated` is always true in this demo store. */
export interface Order {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly isSimulated: true;
  readonly email: string;
  readonly shippingAddress: ShippingAddress;
  readonly currency: CurrencyCode;
  readonly lines: readonly OrderDraftLine[];
  readonly subtotal: Money;
  readonly shipping: Money;
  readonly total: Money;
  readonly createdAt: string;
}
