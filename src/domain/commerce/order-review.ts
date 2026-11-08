import { type ShippingAddress, type OrderDraftLine, type OrderStatus } from "./order";

/**
 * Order review and fulfillment preview rules. Pure. Automation tags orders that a person
 * should check; a tagged order is held until someone clears it. Cancelling is always
 * allowed, so a held order can still be stopped.
 */

export interface ReviewClearance {
  readonly clearedBy: string;
  readonly clearedAt: string;
}

export type ReviewState =
  | { readonly kind: "not_needed" }
  | { readonly kind: "held"; readonly tags: readonly string[] }
  | {
      readonly kind: "cleared";
      readonly tags: readonly string[];
      readonly clearance: ReviewClearance;
    };

const isReviewTag = (tag: string) => tag.startsWith("review:");

export function reviewState(
  tags: readonly string[],
  clearance: ReviewClearance | null,
): ReviewState {
  const reviewTags = tags.filter(isReviewTag);
  if (reviewTags.length === 0) return { kind: "not_needed" };
  return clearance
    ? { kind: "cleared", tags: reviewTags, clearance }
    : { kind: "held", tags: reviewTags };
}

export function reviewBlocksTransition(state: ReviewState, to: OrderStatus): boolean {
  return state.kind === "held" && to !== "cancelled";
}

export const FULFILLMENT_READINESS_LABELS = {
  awaiting_routing: "Waiting for automation to route this order",
  held: "Held for review",
  ready: "Ready to start",
  in_progress: "Being prepared",
  done: "Fulfilled (simulated)",
} as const;
export type FulfillmentReadiness = keyof typeof FULFILLMENT_READINESS_LABELS;

export interface FulfillmentPreview {
  readonly readiness: FulfillmentReadiness;
  /** The `route:*` tag, once automation has routed the order. */
  readonly routeTag: string | null;
  readonly destination: string;
  readonly pickList: ReadonlyArray<{
    readonly sku: string;
    readonly title: string;
    readonly variantTitle: string | null;
    readonly quantity: number;
  }>;
  readonly totalUnits: number;
}

function readiness(
  status: OrderStatus,
  routeTag: string | null,
  review: ReviewState,
): FulfillmentReadiness {
  if (status === "fulfilled") return "done";
  if (status === "processing") return "in_progress";
  if (review.kind === "held") return "held";
  return routeTag ? "ready" : "awaiting_routing";
}

/** What a warehouse would be asked to do. Null for cancelled orders, which ship nothing. */
export function fulfillmentPreview(
  order: {
    readonly status: OrderStatus;
    readonly lines: readonly OrderDraftLine[];
    readonly shippingAddress: ShippingAddress;
  },
  tags: readonly string[],
  review: ReviewState,
): FulfillmentPreview | null {
  if (order.status === "cancelled") return null;
  const routeTag = tags.find((tag) => tag.startsWith("route:")) ?? null;
  return {
    readiness: readiness(order.status, routeTag, review),
    routeTag,
    destination: `${order.shippingAddress.city}, ${order.shippingAddress.region}`,
    pickList: order.lines.map((line) => ({
      sku: line.sku,
      title: line.productTitle,
      variantTitle: line.variantTitle,
      quantity: line.quantity,
    })),
    totalUnits: order.lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}
