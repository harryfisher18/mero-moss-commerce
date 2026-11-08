import { z } from "zod";
import { MAX_QUESTION_LENGTH } from "@/domain/advisor/query";
import { SHIPPING_RULE } from "@/domain/commerce/cart";
import { type Product, priceRange, variantAvailability } from "@/domain/commerce/catalog";
import { formatMoney, money } from "@/domain/commerce/money";
import {
  availabilityMessage,
  type OptionState,
  optionStates,
  type PriceDisplay,
  priceDisplay,
  resolveSelectedVariant,
} from "@/domain/commerce/variant-selection";
import {
  type OrderCreatedPayload,
  redactEmail,
  redactName,
  routeOrder,
  type ShipZone,
} from "@/domain/events/order-created";

/**
 * Rules behind the Upgrade Lab. Each "before" is a deliberately weaker, illustrative
 * experience built for this demo; each "after" uses the rules the store really runs.
 * Nothing here measures or estimates a business result.
 */

export const LAB_TABS = ["product", "discovery", "orders"] as const;
export type LabTab = (typeof LAB_TABS)[number];

export interface LabParams {
  readonly lab: LabTab;
  readonly product: string | undefined;
  readonly question: string;
  readonly order: string | undefined;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const labSchema = z.enum(LAB_TABS).catch("product");
const idSchema = z.string().min(1).max(100).optional().catch(undefined);

/** Validates the URL state. Anything unusable falls back to a safe default. */
export function parseLabParams(raw: Record<string, string | string[] | undefined>): LabParams {
  return {
    lab: labSchema.parse(first(raw.lab)),
    product: idSchema.parse(first(raw.product)),
    question: (first(raw.q) ?? "").trim().slice(0, MAX_QUESTION_LENGTH),
    order: idSchema.parse(first(raw.order)),
  };
}

const hasSoldOutVariant = (product: Product) =>
  product.variants.some((variant) => variantAvailability(variant) === "sold_out");

/** Active products with real variant choices, those with a sold-out variant first. */
export function labProducts(products: readonly Product[], limit = 6): Product[] {
  return products
    .filter((product) => product.status === "active" && product.variants.length > 1)
    .sort(
      (a, b) =>
        Number(hasSoldOutVariant(b)) - Number(hasSoldOutVariant(a)) ||
        a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

// --- Mobile product page ---------------------------------------------------------------

export interface LegacyProductView {
  /** One "from" price that does not follow the selection. */
  readonly priceLabel: string;
  /** Every variant in one list, with no stock information. */
  readonly choices: ReadonlyArray<{ readonly id: string; readonly label: string }>;
}

export function legacyProductView(product: Product): LegacyProductView {
  return {
    priceLabel: `From ${formatMoney(priceRange(product).min)}`,
    choices: product.variants.map((variant) => ({ id: variant.id, label: variant.title })),
  };
}

export const LAB_ADD_PREVIEW = "Preview only: nothing was added to a cart.";
export const LEGACY_ADD_ERROR = "Sorry, there was a problem. Please try again.";

/** The "before" page only discovers a sold-out choice after the shopper presses Add. */
export function legacyAddMessage(product: Product, variantId: string): string {
  const variant = product.variants.find((candidate) => candidate.id === variantId);
  return variant && variant.inventoryQuantity > 0 ? LAB_ADD_PREVIEW : LEGACY_ADD_ERROR;
}

export interface ImprovedProductView {
  readonly variantId: string;
  readonly price: PriceDisplay;
  readonly availability: string;
  readonly options: readonly OptionState[];
  readonly canBuy: boolean;
}

/** The store's real variant, price and stock rules for the current selection. */
export function improvedProductView(
  product: Product,
  variantId: string | undefined,
): ImprovedProductView | null {
  const selected = resolveSelectedVariant(product, variantId);
  if (!selected) return null;
  return {
    variantId: selected.id,
    price: priceDisplay(selected),
    availability: availabilityMessage(selected),
    options: optionStates(product, selected),
    canBuy: selected.inventoryQuantity > 0,
  };
}

// --- Product discovery -----------------------------------------------------------------

export interface KeywordResult {
  readonly title: string;
  readonly handle: string;
  readonly priceLabel: string;
}

/**
 * Illustrative basic search: the whole phrase must appear in a title. It knows nothing
 * about budgets, options or stock, so it cannot exclude what is sold out.
 */
export function keywordSearch(question: string, products: readonly Product[]): KeywordResult[] {
  const phrase = question.trim().toLowerCase();
  if (!phrase) return [];
  return products
    .filter(
      (product) => product.status === "active" && product.title.toLowerCase().includes(phrase),
    )
    .map((product) => {
      const { min, max } = priceRange(product);
      return {
        title: product.title,
        handle: product.handle,
        priceLabel:
          min.amountMinor === max.amountMinor
            ? formatMoney(min)
            : `${formatMoney(min)} – ${formatMoney(max)}`,
      };
    });
}

// --- Order operations ------------------------------------------------------------------

/** Used only when the store has no orders yet. It is labelled and never saved. */
export function sampleOrderPayload(products: readonly Product[]): OrderCreatedPayload | null {
  for (const product of products) {
    if (product.status !== "active") continue;
    const variant = product.variants.find((candidate) => candidate.inventoryQuantity > 0);
    if (!variant) continue;
    const quantity = 2;
    const subtotalMinor = variant.price.amountMinor * quantity;
    const shippingMinor =
      subtotalMinor >= SHIPPING_RULE.freeThresholdMinor ? 0 : SHIPPING_RULE.flatRateMinor;
    return {
      orderId: "sample",
      orderNumber: "Sample order",
      placedAt: "2026-01-01T00:00:00.000Z",
      simulated: true,
      customer: { email: "sample@example.com", name: "Sample Shopper" },
      shipTo: { region: "OR", postalCode: "97205" },
      currency: variant.price.currency,
      lines: [
        {
          sku: variant.sku,
          productTitle: product.title,
          variantTitle: product.variants.length > 1 ? variant.title : null,
          quantity,
          unitPriceMinor: variant.price.amountMinor,
          lineTotalMinor: subtotalMinor,
        },
      ],
      itemCount: quantity,
      subtotalMinor,
      shippingMinor,
      totalMinor: subtotalMinor + shippingMinor,
    };
  }
  return null;
}

/** The same order as the kind of forwarded note a person would have to interpret. */
export function legacyOrderNote(payload: OrderCreatedPayload): string {
  const usd = (minor: number) => formatMoney(money(minor, payload.currency));
  const items = payload.lines
    .map(
      (line) =>
        `${line.quantity}x ${line.productTitle}${line.variantTitle ? ` ${line.variantTitle}` : ""}`,
    )
    .join(", ");
  return [
    `fwd: new order ${payload.orderNumber}`,
    `from ${redactName(payload.customer.name)} ${redactEmail(payload.customer.email)}`,
    `${items} - ${usd(payload.totalMinor)} total, going to ${payload.shipTo.region}`,
    "can someone sort this out and let them know? thx",
  ].join("\n");
}

export interface TriageExpected {
  readonly zone: ShipZone;
  readonly needsReview: boolean;
}

export function expectedTriage(payload: OrderCreatedPayload): TriageExpected {
  const routing = routeOrder(payload);
  return { zone: routing.zone, needsReview: routing.needsReview };
}

/** Compares a person's manual decision with what the automation rules decide. */
export function triageFeedback(
  expected: TriageExpected,
  answer: { readonly zone: string; readonly review: string },
): string {
  const zoneRight = answer.zone === expected.zone;
  const reviewRight = (answer.review === "yes") === expected.needsReview;
  if (zoneRight && reviewRight) return "That matches the automation rules for this order.";
  const wrong = [!zoneRight && "ship zone", !reviewRight && "review decision"].filter(Boolean);
  const verb = wrong.length > 1 ? "differ" : "differs";
  return `The ${wrong.join(" and ")} ${verb} from the automation rules for this order.`;
}
