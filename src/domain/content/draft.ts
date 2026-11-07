import { z } from "zod";
import { CATEGORY_DEFINITIONS, type Product } from "@/domain/commerce/catalog";

/**
 * Product copy that the Content Studio may propose: the title shoppers see, the short
 * summary, and the search/meta description. Pure functions only.
 */

export const CONTENT_FIELDS = ["title", "summary", "seoDescription"] as const;
export type ContentField = (typeof CONTENT_FIELDS)[number];
export type ContentFields = Readonly<Record<ContentField, string>>;

export const CONTENT_FIELD_LABELS: Record<ContentField, string> = {
  title: "Title",
  summary: "Summary",
  seoDescription: "SEO description",
};

export const CONTENT_LIMITS: Record<ContentField, { min: number; max: number }> = {
  title: { min: 3, max: 80 },
  summary: { min: 20, max: 200 },
  seoDescription: { min: 50, max: 160 },
};

/** Boundary schema for submitted or model-generated copy (limits are checked separately). */
export const contentFieldsSchema = z.object({
  title: z.string().max(1000),
  summary: z.string().max(1000),
  seoDescription: z.string().max(1000),
});

export function normalizeContent(fields: ContentFields): ContentFields {
  const clean = (text: string) => text.replace(/\s+/g, " ").trim();
  return {
    title: clean(fields.title),
    summary: clean(fields.summary),
    seoDescription: clean(fields.seoDescription),
  };
}

/** The only facts a draft may rely on. */
export interface ProductFacts {
  readonly title: string;
  readonly category: string;
  readonly summary: string;
  readonly description: string;
  readonly materials: string;
  readonly care: string;
  readonly tags: readonly string[];
  readonly options: ReadonlyArray<{ readonly name: string; readonly values: readonly string[] }>;
}

export function productFacts(product: Product): ProductFacts {
  const options = new Map<string, string[]>();
  for (const variant of product.variants) {
    for (const [name, value] of Object.entries(variant.options)) {
      const values = options.get(name) ?? [];
      if (!values.includes(value)) values.push(value);
      options.set(name, values);
    }
  }
  return {
    title: product.title,
    category: CATEGORY_DEFINITIONS[product.categoryHandle].title,
    summary: product.summary,
    description: product.description,
    materials: product.materials,
    care: product.care,
    tags: product.tags,
    options: [...options.entries()].map(([name, values]) => ({ name, values })),
  };
}

/** The copy currently live in the catalog. */
export function currentContent(product: Product): ContentFields {
  return {
    title: product.title,
    summary: product.summary,
    seoDescription: product.seoDescription,
  };
}

const sentence = (text: string) => {
  const trimmed = text.trim().replace(/[.!?]+$/, "");
  return trimmed ? `${trimmed}.` : "";
};

/** "Solid brass" → "solid brass", but acronyms such as "FSC-certified" keep their case. */
export function lowerFirstWord(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}

function joinList(values: readonly string[]): string {
  if (values.length <= 1) return values.join("");
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1) ?? ""}`;
}

/**
 * Deterministic, rules-based proposal used when no AI key is configured (or the model
 * fails). It only rearranges existing facts, so it cannot introduce new claims: the title
 * and summary are kept, and the SEO description is assembled from the summary, materials
 * and real option values, trimmed to whole sentences within the length limit.
 */
export function rulesDraft(facts: ProductFacts): ContentFields {
  const candidates = [
    `${facts.title}: ${sentence(facts.summary)}`,
    sentence(`Made with ${lowerFirstWord(facts.materials)}`),
    ...facts.options.map((option) =>
      option.values.length > 1 ? sentence(`Available in ${joinList(option.values)}`) : "",
    ),
    sentence(`Part of our ${facts.category} collection`),
  ].filter(Boolean);

  const max = CONTENT_LIMITS.seoDescription.max;
  let seoDescription = "";
  for (const part of candidates) {
    const next = seoDescription ? `${seoDescription} ${part}` : part;
    if (next.length <= max) seoDescription = next;
  }
  if (!seoDescription) {
    // The first sentence alone is too long: cut at a word boundary.
    const first = candidates[0] ?? facts.title;
    const cut = first.slice(0, max - 1);
    seoDescription = `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).replace(/[,:;]$/, "")}…`;
  }
  return normalizeContent({ title: facts.title, summary: facts.summary, seoDescription });
}
