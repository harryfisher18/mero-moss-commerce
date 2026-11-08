import { z } from "zod";
import type { OrderCreatedPayload } from "@/domain/events/order-created";

/**
 * Lifecycle journey definitions, the consent gate and message rendering. Pure. Messages
 * only restate what the shopper already did: no discounts, urgency or invented claims.
 */

export const JOURNEY_IDS = ["welcome", "abandoned_cart", "post_purchase"] as const;
export type JourneyId = (typeof JOURNEY_IDS)[number];

export const JOURNEYS: Record<
  JourneyId,
  { readonly title: string; readonly trigger: string; readonly dedupedBy: string }
> = {
  welcome: {
    title: "Welcome",
    trigger: "A shopper opts in to marketing email.",
    dedupedBy: "Once per email address.",
  },
  abandoned_cart: {
    title: "Abandoned cart",
    trigger: "A shopper asked for a reminder and the cart has not changed for an hour.",
    dedupedBy: "Once per saved state of the cart.",
  },
  post_purchase: {
    title: "Post-purchase",
    trigger: "An order.created event is processed.",
    dedupedBy: "Once per order event.",
  },
};

export const CONSENT_SOURCES = ["checkout", "cart_reminder"] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export const CONSENT_SOURCE_LABELS: Record<ConsentSource, string> = {
  checkout: "Checkout opt-in",
  cart_reminder: "Cart reminder form",
};

export const ABANDONED_AFTER_MS = 60 * 60 * 1000;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const cartReminderSchema = z.object({
  email: z.email("Enter a valid email address.").max(254, "That email address is too long."),
  consent: z.literal("yes", { error: "Please tick the box to agree to reminder emails." }),
});

export interface LifecycleMessage {
  readonly subject: string;
  readonly body: string;
}

export type JourneyDecision =
  | { readonly outcome: "preview"; readonly message: LifecycleMessage }
  | { readonly outcome: "skipped"; readonly reason: "no_consent" | "nothing_to_show" };

/** The consent gate. Without consent the message is not even rendered. */
export function decideJourney(
  hasConsent: boolean,
  render: () => LifecycleMessage | null,
): JourneyDecision {
  if (!hasConsent) return { outcome: "skipped", reason: "no_consent" };
  const message = render();
  return message
    ? { outcome: "preview", message }
    : { outcome: "skipped", reason: "nothing_to_show" };
}

export const welcomeKey = (email: string) => `welcome:${normalizeEmail(email)}`;
export const postPurchaseKey = (eventId: string) => `post_purchase:${eventId}`;
export const abandonedCartKey = (cartId: string, cartUpdatedAt: string) =>
  `abandoned_cart:${cartId}:${cartUpdatedAt}`;

export interface MessageLine {
  readonly title: string;
  readonly variantTitle: string | null;
  readonly quantity: number;
}

const itemLine = ({ title, variantTitle, quantity }: MessageLine) =>
  `- ${String(quantity)} × ${title}${variantTitle ? ` (${variantTitle})` : ""}`;

export function renderWelcome(): LifecycleMessage {
  return {
    subject: "Welcome to Mero & Moss",
    body: [
      "Hello,",
      "",
      "Thank you for joining us. We make well-made essentials for everyday living, and we will write when there is something new to share.",
      "",
      "You can opt out at any time.",
    ].join("\n"),
  };
}

export function renderPostPurchase(payload: OrderCreatedPayload): LifecycleMessage {
  return {
    subject: `Thank you for your order ${payload.orderNumber}`,
    body: [
      "Hello,",
      "",
      "Thank you for choosing Mero & Moss. Your order included:",
      "",
      ...payload.lines.map((line) =>
        itemLine({
          title: line.productTitle,
          variantTitle: line.variantTitle,
          quantity: line.quantity,
        }),
      ),
      "",
      "We hope these serve you well. You can opt out of these emails at any time.",
    ].join("\n"),
  };
}

/** Null when nothing in the cart can still be bought, so no reminder is worth preparing. */
export function renderAbandonedCart(lines: readonly MessageLine[]): LifecycleMessage | null {
  if (lines.length === 0) return null;
  return {
    subject: "You left something in your cart",
    body: [
      "Hello,",
      "",
      "You asked us to remind you about your cart. It still holds:",
      "",
      ...lines.map(itemLine),
      "",
      "You can opt out of these emails at any time.",
    ].join("\n"),
  };
}
