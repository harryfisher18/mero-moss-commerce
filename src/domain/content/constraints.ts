import {
  CONTENT_FIELD_LABELS,
  CONTENT_FIELDS,
  CONTENT_LIMITS,
  type ContentField,
  type ContentFields,
  type ProductFacts,
} from "./draft";

/**
 * Factual-constraint checks for proposed product copy. A draft may only restate facts
 * already in the catalog: no prices, no numbers that aren't in the facts, no materials the
 * product isn't made of, and no promotional or unverifiable claims. Copy that fails any
 * check cannot be approved. The same checks apply to rules-based, AI and edited drafts.
 */

export type ConstraintRule = "length" | "price" | "number" | "material" | "claim";

export interface Violation {
  readonly field: ContentField;
  readonly rule: ConstraintRule;
  readonly message: string;
}

/** Materials the checker recognizes. Mentioning one requires it to be in the facts. */
export const KNOWN_MATERIALS = [
  "linen",
  "cotton",
  "wool",
  "merino",
  "cashmere",
  "silk",
  "leather",
  "suede",
  "felt",
  "canvas",
  "jute",
  "seagrass",
  "rattan",
  "bamboo",
  "oak",
  "walnut",
  "cedar",
  "teak",
  "olive wood",
  "brass",
  "copper",
  "steel",
  "stainless steel",
  "aluminum",
  "iron",
  "cast iron",
  "gold",
  "silver",
  "stoneware",
  "porcelain",
  "ceramic",
  "glass",
  "marble",
  "plastic",
  "polyester",
  "nylon",
  "velvet",
] as const;

/** Promotional or unverifiable claims. Allowed only when the facts themselves say so. */
export const CLAIM_TERMS = [
  "best",
  "finest",
  "perfect",
  "#1",
  "number one",
  "best-selling",
  "bestseller",
  "guaranteed",
  "guarantee",
  "warranty",
  "lifetime",
  "award",
  "award-winning",
  "certified",
  "organic",
  "eco-friendly",
  "sustainable",
  "sustainably",
  "recycled",
  "handmade",
  "hand-made",
  "artisan",
  "luxury",
  "premium",
  "waterproof",
  "fireproof",
  "non-toxic",
  "hypoallergenic",
  "antibacterial",
  "dishwasher-safe",
  "dishwasher safe",
  "microwave-safe",
  "microwave safe",
  "fair trade",
  "vegan",
  "clinically",
  "patented",
  "limited edition",
  "exclusive",
  "sale",
  "discount",
  "free",
  "cheapest",
  "bargain",
] as const;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function mentions(haystack: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9#-])${escapeRegExp(term)}($|[^a-z0-9-])`, "i").test(haystack);
}

export function factsText(facts: ProductFacts): string {
  return [
    facts.title,
    facts.category,
    facts.summary,
    facts.description,
    facts.materials,
    facts.care,
    ...facts.tags,
    ...facts.options.flatMap((o) => [o.name, ...o.values]),
  ]
    .join(" \n ")
    .toLowerCase();
}

const PRICE_PATTERN =
  /[$€£]\s?\d|\b\d+(?:\.\d+)?\s?(?:usd|dollars?|bucks)\b|\bprice[sd]?\b|\bcosts?\b/i;
const PERCENT_PATTERN = /\d+(?:\.\d+)?\s?%/g;
const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/g;

export function checkContent(fields: ContentFields, facts: ProductFacts): Violation[] {
  const haystack = factsText(facts);
  const factNumbers = new Set(haystack.match(NUMBER_PATTERN) ?? []);
  const violations: Violation[] = [];

  for (const field of CONTENT_FIELDS) {
    const text = fields[field];
    const label = CONTENT_FIELD_LABELS[field];
    const { min, max } = CONTENT_LIMITS[field];
    if (text.length < min || text.length > max) {
      violations.push({
        field,
        rule: "length",
        message: `${label} must be ${String(min)}–${String(max)} characters (now ${String(text.length)}).`,
      });
    }
    if (PRICE_PATTERN.test(text)) {
      violations.push({
        field,
        rule: "price",
        message: `${label} mentions a price. Prices change, so copy must not state them.`,
      });
    }
    // Percentages are allowed only when the facts state them (e.g. "100% linen").
    const compactFacts = haystack.replace(/\s/g, "");
    for (const percent of new Set(text.match(PERCENT_PATTERN) ?? [])) {
      if (!compactFacts.includes(percent.replace(/\s/g, ""))) {
        violations.push({
          field,
          rule: "price",
          message: `${label} states “${percent}”, which is not in the product facts.`,
        });
      }
    }
    for (const number of new Set(text.match(NUMBER_PATTERN) ?? [])) {
      if (!factNumbers.has(number)) {
        violations.push({
          field,
          rule: "number",
          message: `${label} states “${number}”, which is not in the product facts.`,
        });
      }
    }
    // Longest names first so "cast iron" is checked before "iron".
    const materials = [...KNOWN_MATERIALS].sort((a, b) => b.length - a.length);
    let remaining = text.toLowerCase();
    for (const material of materials) {
      if (!mentions(remaining, material)) continue;
      if (!mentions(haystack, material)) {
        violations.push({
          field,
          rule: "material",
          message: `${label} mentions “${material}”, but the product facts do not list it.`,
        });
      }
      remaining = remaining.replace(new RegExp(escapeRegExp(material), "gi"), " ");
    }
    for (const claim of CLAIM_TERMS) {
      if (mentions(text, claim) && !mentions(haystack, claim)) {
        violations.push({
          field,
          rule: "claim",
          message: `${label} claims “${claim}”, which the product facts do not support.`,
        });
      }
    }
  }
  return violations;
}
