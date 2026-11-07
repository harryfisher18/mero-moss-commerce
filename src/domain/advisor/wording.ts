import { formatMoney, parseMoneyInput } from "@/domain/commerce/money";
import type { AdvisorAnswer } from "./answer";

/**
 * Guard rails for optional LLM wording. The model only rephrases facts we already
 * validated; its output is accepted only if it introduces no new prices, percentages,
 * codes, links or contact details. Anything else falls back to the catalog wording.
 */

export const MAX_WORDING_LENGTH = 700;

/** The only facts the model sees. Catalog text is data, never instructions. */
export function wordingFacts(answer: AdvisorAnswer) {
  return {
    lead: answer.lead,
    items: answer.cards.map((card) => ({
      title: card.productTitle,
      variant: card.variantTitle,
      price: formatMoney(card.price),
      compareAtPrice: card.compareAtPrice ? formatMoney(card.compareAtPrice) : null,
      stock: card.stock,
      reasons: card.reasons,
    })),
    policies: answer.policies.map((policy) => ({ title: policy.title, text: policy.body })),
    notes: answer.notes,
  };
}

const MONEY_PATTERN = /\$\s?\d[\d,]*(?:\.\d+)?/g;

function amountsIn(text: string): number[] {
  return (text.match(MONEY_PATTERN) ?? [])
    .map((raw) => parseMoneyInput(raw.replace(/\s/g, ""), "USD")?.amountMinor)
    .filter((value): value is number => value !== undefined);
}

export type WordingCheck = { ok: true; text: string } | { ok: false; reason: string };

export function validateWording(raw: string, answer: AdvisorAnswer): WordingCheck {
  const text = raw.trim();
  if (text.length === 0) return { ok: false, reason: "empty" };
  if (text.length > MAX_WORDING_LENGTH) return { ok: false, reason: "too long" };

  const factText = JSON.stringify(wordingFacts(answer));
  const allowed = new Set(amountsIn(factText));
  const unknown = amountsIn(text).filter((amount) => !allowed.has(amount));
  if (unknown.length > 0) return { ok: false, reason: "price not in catalog facts" };
  // Any bare money amount that failed to parse (e.g. "$1.999") is also rejected.
  if ((text.match(MONEY_PATTERN) ?? []).length !== amountsIn(text).length) {
    return { ok: false, reason: "unparseable price" };
  }
  if (/%|\bpercent\b/i.test(text)) return { ok: false, reason: "percentage" };
  if (/\b(code|coupon|promo|voucher)s?\b/i.test(text))
    return { ok: false, reason: "discount code" };
  if (/https?:\/\/|www\.|<[a-z/]/i.test(text)) return { ok: false, reason: "link or markup" };
  if (/[^\s@]+@[^\s@]+/.test(text)) return { ok: false, reason: "contact detail" };
  if (/\bfree\b/i.test(text) && !/\bfree\b/i.test(factText)) {
    return { ok: false, reason: "free claim not in facts" };
  }
  return { ok: true, text };
}
