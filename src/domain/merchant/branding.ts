import { z } from "zod";

/**
 * Storefront branding the merchant can edit: the tagline under the store name and an
 * optional announcement line above the header. The store name itself is fixed, because
 * shoppers must only ever see the Mero & Moss brand. Pure functions only.
 */

export interface Branding {
  readonly tagline: string;
  readonly announcement: string;
}

/** The seeded wording, also used whenever nothing has been saved (for example after a reset). */
export const DEFAULT_BRANDING: Branding = {
  tagline: "Well-made essentials for everyday living.",
  announcement: "",
};

export const TAGLINE_MAX = 80;
export const ANNOUNCEMENT_MAX = 140;

/**
 * Names that must never appear on customer-facing surfaces (product rule). Matched as
 * whole words, case-insensitively.
 */
const FORBIDDEN_NAMES = [
  "CommerceFlow",
  "GrowthOps",
  "Studio",
  "Builder",
  "AI platform",
  "Portfolio",
  "Developer showcase",
];

// Line breaks, tabs and other control characters have no place in a single line of copy.
const CONTROL = /[\u0000-\u001f\u007f]/;

function line(label: string, min: number, max: number) {
  return z
    .string()
    .transform((value) => value.trim().replace(/ {2,}/g, " "))
    .pipe(
      z
        .string()
        .min(min, `${label} is required.`)
        .max(max, `Keep the ${label.toLowerCase()} to ${String(max)} characters or fewer.`)
        .refine((value) => !CONTROL.test(value), `${label} must be a single line of plain text.`)
        .refine(
          (value) => !/[<>]/.test(value),
          `${label} must be plain text, without < or > characters.`,
        )
        .refine(
          (value) =>
            !FORBIDDEN_NAMES.some((name) =>
              new RegExp(`\\b${name.replace(/ /g, "\\s+")}\\b`, "i").test(value),
            ),
          `${label} must not name anything other than Mero & Moss to shoppers.`,
        ),
    );
}

const brandingSchema = z.object({
  tagline: line("Tagline", 1, TAGLINE_MAX),
  announcement: line("Announcement", 0, ANNOUNCEMENT_MAX),
});

export type BrandingErrors = Readonly<Partial<Record<keyof Branding, string>>>;

export type ParseBrandingResult =
  | { readonly ok: true; readonly branding: Branding }
  | { readonly ok: false; readonly errors: BrandingErrors };

export function parseBranding(raw: { tagline: string; announcement: string }): ParseBrandingResult {
  const result = brandingSchema.safeParse(raw);
  if (result.success) return { ok: true, branding: result.data };
  const errors: Partial<Record<keyof Branding, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if ((field === "tagline" || field === "announcement") && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return { ok: false, errors };
}

export interface BrandingChange {
  readonly field: keyof Branding;
  readonly before: string;
  readonly after: string;
}

/** The fields that differ, in a stable order. */
export function diffBranding(before: Branding, after: Branding): BrandingChange[] {
  return (["tagline", "announcement"] as const)
    .filter((field) => before[field] !== after[field])
    .map((field) => ({ field, before: before[field], after: after[field] }));
}
