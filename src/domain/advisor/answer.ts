import { CATEGORY_DEFINITIONS } from "@/domain/commerce/catalog";
import { formatMoney, type Money, money } from "@/domain/commerce/money";
import type { PolicyKey, StorePolicy } from "@/domain/commerce/policies";
import { availabilityMessage } from "@/domain/commerce/variant-selection";
import type { IntentKind, ShopperIntent } from "./query";
import { type Retrieval, variantLabel } from "./retrieval";

/**
 * Composes the advisor's reply from retrieval results and stored policies only. Nothing
 * here invents a fact: prices, stock and policy text are copied from catalog rows.
 */

export interface AdvisorCard {
  readonly productTitle: string;
  readonly productHandle: string;
  readonly variantId: string;
  readonly variantTitle: string | null;
  readonly price: Money;
  /** Only set when it is above the price (a real sale). */
  readonly compareAtPrice: Money | null;
  readonly stock: string;
  readonly summary: string;
  readonly materials: string;
  readonly url: string;
  readonly reasons: readonly string[];
}

export interface QuotedPolicy {
  readonly key: PolicyKey;
  readonly title: string;
  readonly body: string;
}

export interface AdvisorAnswer {
  readonly kind: IntentKind;
  readonly lead: string;
  readonly cards: readonly AdvisorCard[];
  readonly policies: readonly QuotedPolicy[];
  readonly notes: readonly string[];
  /** Offer the "talk to a person" form prominently. */
  readonly suggestEscalation: boolean;
}

export const NO_DISCOUNT_CODES_NOTE =
  "I can't see any discount codes in our store, so I won't suggest one. Sale prices, when there are any, are shown on each item.";

function constraintPhrase(intent: ShopperIntent): string {
  const parts: string[] = [];
  const usd = (minor: number) => formatMoney(money(minor, "USD"));
  if (intent.category) parts.push(`in ${CATEGORY_DEFINITIONS[intent.category].title}`);
  if (intent.optionValues.length > 0) parts.push(`in ${intent.optionValues.join(" / ")}`);
  if (intent.minPriceMinor !== null && intent.maxPriceMinor !== null) {
    parts.push(`between ${usd(intent.minPriceMinor)} and ${usd(intent.maxPriceMinor)}`);
  } else if (intent.maxPriceMinor !== null) {
    parts.push(`under ${usd(intent.maxPriceMinor)}`);
  } else if (intent.minPriceMinor !== null) {
    parts.push(`over ${usd(intent.minPriceMinor)}`);
  }
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

function quote(policies: readonly StorePolicy[], keys: readonly PolicyKey[]): QuotedPolicy[] {
  return policies
    .filter((policy) => keys.includes(policy.key))
    .map((policy) => ({ key: policy.key, title: policy.title, body: policy.body }));
}

export function composeAnswer(
  intent: ShopperIntent,
  retrieval: Retrieval,
  policies: readonly StorePolicy[],
): AdvisorAnswer {
  if (intent.kind === "escalate") {
    return {
      kind: "escalate",
      lead: "I'll pass this to our team. Leave your email and question below, and a person will reply.",
      cards: [],
      policies: [],
      notes: [],
      suggestEscalation: true,
    };
  }

  const quoted = quote(policies, intent.policyKeys);
  if (intent.kind === "policy") {
    if (quoted.length === 0) {
      return {
        kind: "policy",
        lead: "I don't have a published policy that answers that, so I won't guess. Our team can help.",
        cards: [],
        policies: [],
        notes: [],
        suggestEscalation: true,
      };
    }
    return {
      kind: "policy",
      lead: `Here is our ${quoted.map((p) => p.title.toLowerCase()).join(" and ")} policy, word for word.`,
      cards: [],
      policies: quoted,
      notes: [],
      suggestEscalation: false,
    };
  }

  const cards: AdvisorCard[] = retrieval.matches.map(({ product, variant, reasons }) => ({
    productTitle: product.title,
    productHandle: product.handle,
    variantId: variant.id,
    variantTitle: variantLabel(product, variant),
    price: variant.price,
    compareAtPrice:
      variant.compareAtPrice && variant.compareAtPrice.amountMinor > variant.price.amountMinor
        ? variant.compareAtPrice
        : null,
    stock: availabilityMessage(variant),
    summary: product.summary,
    materials: product.materials,
    url: `/products/${product.handle}?variant=${encodeURIComponent(variant.id)}`,
    reasons,
  }));

  const notes: string[] = retrieval.unavailable.map(
    ({ product, variantTitle }) =>
      `${product.title}${variantTitle ? ` (${variantTitle})` : ""} is sold out right now.`,
  );
  if (intent.wantsSale) notes.push(NO_DISCOUNT_CODES_NOTE);

  const constraints = constraintPhrase(intent);
  let lead: string;
  if (intent.kind === "compare") {
    lead =
      cards.length >= 2
        ? "Here they are side by side, with current prices and stock."
        : cards.length === 1
          ? "I could only find one of those in stock. Here it is."
          : "I couldn't find those items in stock. Try their names as they appear in the shop.";
  } else if (intent.vague) {
    lead =
      "Tell me what you are shopping for, such as a category, color, size or budget, and I will find in-stock options.";
  } else if (intent.saleOnly) {
    lead =
      cards.length === 0
        ? "Nothing is on sale right now."
        : `Here ${cards.length === 1 ? "is 1 item" : `are ${cards.length} items`} on sale right now.`;
  } else if (cards.length === 0) {
    lead = `I couldn't find anything in stock${constraints} that matches. Try fewer details, or ask our team.`;
  } else if (retrieval.relaxed) {
    lead = `Nothing matched every word you used, so here ${cards.length === 1 ? "is an in-stock pick" : `are ${cards.length} in-stock picks`}${constraints}.`;
  } else {
    lead = `Here ${cards.length === 1 ? "is 1 in-stock pick" : `are ${cards.length} in-stock picks`}${constraints}.`;
  }

  return {
    kind: intent.kind,
    lead,
    cards,
    policies: quoted,
    notes,
    suggestEscalation: cards.length === 0 && !intent.vague && !intent.saleOnly,
  };
}
