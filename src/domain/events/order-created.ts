import { z } from "zod";
import { formatMoney, money, SUPPORTED_CURRENCIES } from "@/domain/commerce/money";
import { type Order, type RegionCode, SHIPPING_REGIONS } from "@/domain/commerce/order";

/**
 * The `order.created` event: payload, deterministic routing and review rules, notification
 * previews and PII redaction for the job inspector. Everything here is pure.
 */

const REGION_CODES = Object.keys(SHIPPING_REGIONS) as [RegionCode, ...RegionCode[]];
const minor = z.number().int().nonnegative();

export const orderCreatedPayloadSchema = z.object({
  orderId: z.string().min(1).max(100),
  orderNumber: z.string().min(1).max(40),
  placedAt: z.string().min(1).max(40),
  simulated: z.literal(true),
  customer: z.object({ email: z.email(), name: z.string().min(1).max(200) }),
  shipTo: z.object({ region: z.enum(REGION_CODES), postalCode: z.string().min(1).max(20) }),
  currency: z.enum(SUPPORTED_CURRENCIES),
  lines: z
    .array(
      z.object({
        sku: z.string().min(1),
        productTitle: z.string().min(1),
        variantTitle: z.string().nullable(),
        quantity: z.number().int().positive(),
        unitPriceMinor: minor,
        lineTotalMinor: minor,
      }),
    )
    .min(1),
  itemCount: z.number().int().positive(),
  subtotalMinor: minor,
  shippingMinor: minor,
  totalMinor: minor,
});

export type OrderCreatedPayload = z.infer<typeof orderCreatedPayloadSchema>;

export function orderCreatedPayload(order: Order): OrderCreatedPayload {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    placedAt: order.createdAt,
    simulated: true,
    customer: { email: order.email, name: order.shippingAddress.fullName },
    shipTo: { region: order.shippingAddress.region, postalCode: order.shippingAddress.postalCode },
    currency: order.currency,
    lines: order.lines.map((line) => ({
      sku: line.sku,
      productTitle: line.productTitle,
      variantTitle: line.variantTitle,
      quantity: line.quantity,
      unitPriceMinor: line.unitPrice.amountMinor,
      lineTotalMinor: line.lineTotal.amountMinor,
    })),
    itemCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalMinor: order.subtotal.amountMinor,
    shippingMinor: order.shipping.amountMinor,
    totalMinor: order.total.amountMinor,
  };
}

// --- Routing --------------------------------------------------------------------------

export const SHIP_ZONES = ["west", "central", "east"] as const;
export type ShipZone = (typeof SHIP_ZONES)[number];

/** Which fulfilment zone handles each shipping region. Typed so no region can be missed. */
export const REGION_ZONES: Record<RegionCode, ShipZone> = {
  WA: "west",
  OR: "west",
  CA: "west",
  NV: "west",
  ID: "west",
  MT: "west",
  WY: "west",
  UT: "west",
  AZ: "west",
  CO: "west",
  NM: "west",
  ND: "central",
  SD: "central",
  NE: "central",
  KS: "central",
  OK: "central",
  TX: "central",
  MN: "central",
  IA: "central",
  MO: "central",
  AR: "central",
  LA: "central",
  WI: "central",
  IL: "central",
  MI: "central",
  IN: "central",
  OH: "central",
  KY: "central",
  TN: "central",
  MS: "central",
  AL: "central",
  ME: "east",
  NH: "east",
  VT: "east",
  MA: "east",
  RI: "east",
  CT: "east",
  NY: "east",
  NJ: "east",
  PA: "east",
  DE: "east",
  MD: "east",
  DC: "east",
  VA: "east",
  WV: "east",
  NC: "east",
  SC: "east",
  GA: "east",
  FL: "east",
};

/** Orders that a person should look at before fulfilment. */
export const REVIEW_RULES = {
  /** Total at or above this amount (minor units). */
  highValueMinor: 50_000,
  /** Any single line with at least this many units. */
  bulkQuantity: 5,
} as const;

export type OrderTag = `route:${ShipZone}` | "review:high-value" | "review:bulk-quantity";

export interface OrderRouting {
  readonly zone: ShipZone;
  readonly tags: readonly OrderTag[];
  readonly reviewReasons: readonly string[];
  readonly needsReview: boolean;
}

export function routeOrder(payload: OrderCreatedPayload): OrderRouting {
  const zone = REGION_ZONES[payload.shipTo.region];
  const tags: OrderTag[] = [`route:${zone}`];
  const reviewReasons: string[] = [];
  if (payload.totalMinor >= REVIEW_RULES.highValueMinor) {
    tags.push("review:high-value");
    reviewReasons.push(
      `Order total ${formatMoney(money(payload.totalMinor, payload.currency))} is at or above ${formatMoney(money(REVIEW_RULES.highValueMinor, payload.currency))}.`,
    );
  }
  const bulk = payload.lines.find((line) => line.quantity >= REVIEW_RULES.bulkQuantity);
  if (bulk) {
    tags.push("review:bulk-quantity");
    reviewReasons.push(
      `${bulk.quantity} units of ${bulk.productTitle} in one line (${REVIEW_RULES.bulkQuantity} or more).`,
    );
  }
  return { zone, tags, reviewReasons, needsReview: reviewReasons.length > 0 };
}

export const TAG_LABELS: Record<OrderTag, string> = {
  "route:west": "Ship zone: West",
  "route:central": "Ship zone: Central",
  "route:east": "Ship zone: East",
  "review:high-value": "Review: high value",
  "review:bulk-quantity": "Review: bulk quantity",
};

export function tagLabel(tag: string): string {
  return tag in TAG_LABELS ? TAG_LABELS[tag as OrderTag] : tag;
}

// --- Notification previews -----------------------------------------------------------

export const NOTIFICATION_KINDS = ["customer_confirmation", "merchant_review"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  customer_confirmation: "Customer order confirmation (email)",
  merchant_review: "Operations review request (internal)",
};

export interface NotificationPreview {
  readonly kind: NotificationKind;
  readonly recipient: string;
  readonly subject: string;
  readonly body: string;
}

export const OPERATIONS_RECIPIENT = "Order operations team (internal)";

const ZONE_NAMES: Record<ShipZone, string> = { west: "West", central: "Central", east: "East" };

/**
 * The messages this event would send. They are recorded as previews only: nothing in this
 * project delivers email or chat messages.
 */
export function notificationPreviews(
  payload: OrderCreatedPayload,
  routing: OrderRouting,
): NotificationPreview[] {
  const format = (amountMinor: number) => formatMoney(money(amountMinor, payload.currency));
  const items = payload.lines.map(
    (line) =>
      `- ${line.quantity} × ${line.productTitle}${line.variantTitle ? ` (${line.variantTitle})` : ""}: ${format(line.lineTotalMinor)}`,
  );
  const previews: NotificationPreview[] = [
    {
      kind: "customer_confirmation",
      recipient: payload.customer.email,
      subject: `Your Mero & Moss order ${payload.orderNumber} is confirmed`,
      body: [
        "Hello,",
        "",
        "Thank you for your order. Here is what we are preparing:",
        "",
        ...items,
        "",
        `Subtotal: ${format(payload.subtotalMinor)}`,
        `Shipping: ${payload.shippingMinor === 0 ? "Free" : format(payload.shippingMinor)}`,
        `Total: ${format(payload.totalMinor)}`,
        "",
        `Shipping to ${SHIPPING_REGIONS[payload.shipTo.region]}.`,
        "",
        "This order was placed in the Mero & Moss demo store. No payment was taken.",
      ].join("\n"),
    },
  ];
  if (routing.needsReview) {
    previews.push({
      kind: "merchant_review",
      recipient: OPERATIONS_RECIPIENT,
      subject: `Review needed before fulfilment: ${payload.orderNumber}`,
      body: [
        `${payload.orderNumber} was held for review:`,
        "",
        ...routing.reviewReasons.map((reason) => `- ${reason}`),
        "",
        `Routed to the ${ZONE_NAMES[routing.zone]} ship zone.`,
        "Open the order in the merchant console to review it.",
      ].join("\n"),
    });
  }
  return previews;
}

// --- Redaction -----------------------------------------------------------------------

/** "avery@example.com" → "a***@example.com". Non-email strings are fully masked. */
export function redactEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

/** "Avery Stone" → "A. S." */
export function redactName(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}.`);
  return initials.length > 0 ? initials.join(" ") : "***";
}

export function redactRecipient(recipient: string): string {
  return recipient === OPERATIONS_RECIPIENT ? recipient : redactEmail(recipient);
}

/** The payload as the job inspector shows it, with personal data masked. */
export function redactPayload(payload: OrderCreatedPayload): OrderCreatedPayload {
  return {
    ...payload,
    customer: {
      email: redactEmail(payload.customer.email),
      name: redactName(payload.customer.name),
    },
    shipTo: { ...payload.shipTo, postalCode: `${payload.shipTo.postalCode.slice(0, 3)}**` },
  };
}
