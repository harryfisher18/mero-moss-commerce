import type { CategoryHandle } from "@/domain/commerce/catalog";
import { parseMoneyInput } from "@/domain/commerce/money";
import type { PolicyKey } from "@/domain/commerce/policies";

/**
 * Turns a shopper's free-text question into structured, checkable constraints. Pure and
 * deterministic: the advisor's facts come from these constraints and the catalog, never
 * from a model.
 */

export const MAX_QUESTION_LENGTH = 300;

export type IntentKind = "products" | "compare" | "policy" | "escalate";

export interface ShopperIntent {
  readonly kind: IntentKind;
  readonly question: string;
  readonly minPriceMinor: number | null;
  readonly maxPriceMinor: number | null;
  readonly category: CategoryHandle | null;
  /** Option values from the catalog's own vocabulary, e.g. "Oat", "Large". */
  readonly optionValues: readonly string[];
  readonly keywords: readonly string[];
  readonly policyKeys: readonly PolicyKey[];
  readonly wantsSale: boolean;
  readonly cheapestFirst: boolean;
  /** Only a sale or discount question, with no other product details. */
  readonly saleOnly: boolean;
  /** No product details at all, so the advisor should ask what the shopper wants. */
  readonly vague: boolean;
  /** For comparisons: the separate product phrases being compared. */
  readonly compareTerms: readonly (readonly string[])[];
}

const CATEGORY_WORDS: Record<CategoryHandle, readonly string[]> = {
  "home-organization": [
    "organize",
    "organizing",
    "organization",
    "storage",
    "closet",
    "entryway",
    "laundry",
    "declutter",
  ],
  "table-and-kitchen": ["kitchen", "table", "dining", "dinner", "cooking", "tableware", "pantry"],
  workspace: ["desk", "office", "workspace", "study", "workstation"],
  "travel-essentials": ["travel", "trip", "packing", "luggage", "flight", "journey", "vacation"],
};

const POLICY_WORDS: Record<PolicyKey, readonly string[]> = {
  shipping: ["ship", "shipping", "delivery", "deliver", "arrive", "dispatch", "postage"],
  returns: ["return", "returns", "refund", "refunds", "exchange"],
  "care-and-warranty": ["warranty", "guarantee", "repair", "defect", "defective", "broken"],
  "demo-store": ["demo", "payment", "charged", "real"],
};

const ESCALATION_PATTERN =
  /\b(human|person|someone|representative|agent|staff|talk to|speak to|speak with|contact|complaint|where is my order|order status|track my order)\b/;
const SALE_PATTERN = /\b(discount|discounts|coupon|coupons|promo|promotion|code|sale|deal|deals)\b/;
const CHEAPEST_PATTERN = /\b(cheapest|cheap|affordable|lowest price|least expensive|budget)\b/;
const COMPARE_PATTERN = /\b(compare|comparison|versus|vs\.?|difference between)\b/;

const STOPWORDS = new Set(
  `a an the and or of for to in on at with without my me i we you your our us is are be it this that
   these those do does have has any some something things thing what which who how can could would
   should will want need looking look show find get give tell about please under below less than over
   above more between around up max maximum budget price prices cost costs dollars dollar usd cheap
   cheapest affordable best good nice great gift gifts present idea ideas recommend recommendation
   suggest suggestion options option buy shop store item items product products piece pieces one ones
   in-stock stock available availability compare versus vs difference sale deal deals discount code
   coupon promo color colour size like also just only really very much many lot from into than then
   there their them they him her his she he its it's i'm im policy policies terms rule rules
   when long take takes does work works hello hi hey help thanks thank`
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => stem(word)),
);

/** Lowercases and folds a word to a simple singular form for matching. */
export function stem(word: string): string {
  const w = word.toLowerCase();
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(ches|shes|xes|ses)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? []).map(stem);
}

// Numbers followed by a unit ("30 days", "500 ml") are not prices.
const AMOUNT = String.raw`\$?\s?(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)(?!\d|\s*(?:days?|weeks?|months?|years?|business|units?|items?|pieces?|pcs|ml|l\b|cm|mm|inch|in\b|%))`;

function toMinor(text: string | undefined): number | null {
  if (!text) return null;
  return parseMoneyInput(text, "USD")?.amountMinor ?? null;
}

/** Budget constraints in minor units. Ranges, upper bounds, lower bounds and "around $x". */
export function parseBudget(text: string): { min: number | null; max: number | null } {
  const lower = text.toLowerCase();
  const range =
    new RegExp(String.raw`between\s+${AMOUNT}\s+(?:and|to|-)\s+${AMOUNT}`).exec(lower) ??
    new RegExp(String.raw`${AMOUNT}\s*(?:-|–|to)\s*${AMOUNT}`).exec(lower);
  if (range && (range[0].includes("$") || range[0].startsWith("between"))) {
    const a = toMinor(range[1]);
    const b = toMinor(range[2]);
    if (a !== null && b !== null) return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const around = new RegExp(String.raw`(?:around|about|roughly|approximately|~)\s*${AMOUNT}`).exec(
    lower,
  );
  if (around) {
    const value = toMinor(around[1]);
    if (value !== null) return { min: Math.floor(value * 0.8), max: Math.ceil(value * 1.2) };
  }
  const max = new RegExp(
    String.raw`(?:under|below|less than|up to|at most|max(?:imum)?|no more than|<=?)\s*${AMOUNT}`,
  ).exec(lower);
  const min = new RegExp(String.raw`(?:over|above|more than|at least|from|>=?)\s*${AMOUNT}`).exec(
    lower,
  );
  if (max || min) return { min: toMinor(min?.[1]), max: toMinor(max?.[1]) };
  // A bare "$40" reads as a budget ceiling.
  const bare = /\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/.exec(lower);
  return { min: null, max: toMinor(bare?.[1]) };
}

export function parseShopperQuery(
  rawQuestion: string,
  vocabulary: { readonly optionValues: readonly string[] },
): ShopperIntent {
  const question = rawQuestion.replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION_LENGTH);
  const lower = question.toLowerCase();
  const tokens = tokenize(question);
  const tokenSet = new Set(tokens);

  const optionValues = vocabulary.optionValues.filter((value) => {
    const valueTokens = tokenize(value);
    return valueTokens.length > 0 && valueTokens.every((t) => tokenSet.has(t));
  });
  const optionTokens = new Set(optionValues.flatMap((value) => tokenize(value)));

  let category: CategoryHandle | null = null;
  for (const [handle, words] of Object.entries(CATEGORY_WORDS) as [
    CategoryHandle,
    readonly string[],
  ][]) {
    if (words.some((word) => tokenSet.has(stem(word)))) {
      category = handle;
      break;
    }
  }

  const policyKeys = (Object.entries(POLICY_WORDS) as [PolicyKey, readonly string[]][])
    .filter(([, words]) => words.some((word) => tokenSet.has(stem(word))))
    .map(([key]) => key);

  const budget = parseBudget(question);
  const keywords = [
    ...new Set(
      tokens.filter(
        (t) => t.length >= 3 && !/^\d/.test(t) && !STOPWORDS.has(t) && !optionTokens.has(t),
      ),
    ),
  ];
  // Words that only signal a category or policy topic are not product keywords.
  const signalWords = new Set(
    [...Object.values(CATEGORY_WORDS).flat(), ...Object.values(POLICY_WORDS).flat()].map(stem),
  );
  const productKeywords = keywords.filter((k) => !signalWords.has(k));

  const wantsSale = SALE_PATTERN.test(lower);
  const hasProductSignal =
    productKeywords.length > 0 ||
    category !== null ||
    optionValues.length > 0 ||
    budget.max !== null ||
    budget.min !== null;

  let kind: IntentKind = "products";
  let compareTerms: string[][] = [];
  if (ESCALATION_PATTERN.test(lower)) {
    kind = "escalate";
  } else if (COMPARE_PATTERN.test(lower)) {
    kind = "compare";
    const body = lower.replace(/^.*?\b(compare|comparison|difference between)\b/, "");
    compareTerms = body
      .split(/\b(?:and|vs\.?|versus|or|with)\b|,/)
      .map((part) => tokenize(part).filter((t) => t.length >= 3 && !STOPWORDS.has(t)))
      .filter((part) => part.length > 0);
  } else if (
    policyKeys.length > 0 &&
    category === null &&
    optionValues.length === 0 &&
    budget.max === null &&
    budget.min === null
  ) {
    // "Is there a lifetime warranty?" or "Can I return the lamp?" are policy questions,
    // even with extra words; category, option or budget details make it a product search.
    kind = "policy";
  }

  return {
    kind,
    question,
    minPriceMinor: budget.min,
    maxPriceMinor: budget.max,
    category,
    optionValues,
    keywords: productKeywords,
    policyKeys,
    wantsSale,
    cheapestFirst: CHEAPEST_PATTERN.test(lower),
    saleOnly: kind === "products" && wantsSale && !hasProductSignal,
    vague: kind === "products" && !wantsSale && !hasProductSignal,
    compareTerms,
  };
}
