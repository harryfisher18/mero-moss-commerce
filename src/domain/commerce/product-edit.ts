import { z } from "zod";
import type { Product, ProductStatus } from "./catalog";
import { type Money, parseMoneyInput, toDecimalString } from "./money";
import { priceDisplay } from "./variant-selection";

/**
 * Merchant product editing rules: validation of submitted form values and a field-level
 * diff that drives the audit log. Pure functions only.
 */

export const MAX_STOCK = 100_000;
export const PRODUCT_STATUSES = ["active", "draft", "archived"] as const;

export interface VariantEdit {
  readonly id: string;
  readonly price: Money;
  readonly compareAtPrice: Money | null;
  readonly inventoryQuantity: number;
}

export interface ProductEdit {
  readonly title: string;
  readonly summary: string;
  readonly description: string;
  readonly status: ProductStatus;
  readonly variants: readonly VariantEdit[];
}

/** Raw strings as submitted by the editor form. */
export interface RawProductEdit {
  readonly title: string;
  readonly summary: string;
  readonly description: string;
  readonly status: string;
  readonly variants: ReadonlyArray<{
    readonly id: string;
    readonly price: string;
    readonly compareAt: string;
    readonly stock: string;
  }>;
}

/** Field keys: "title", "summary", "description", "status", "form", or "<variantId>.<field>". */
export type EditErrors = Readonly<Record<string, string>>;

export type ParseEditResult =
  | { readonly ok: true; readonly edit: ProductEdit }
  | { readonly ok: false; readonly errors: EditErrors };

const textFields = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(120, "Keep the title under 120 characters."),
  summary: z
    .string()
    .trim()
    .min(1, "Summary is required.")
    .max(200, "Keep the summary under 200 characters."),
  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(2000, "Keep the description under 2,000 characters."),
  status: z.enum(PRODUCT_STATUSES, { error: "Choose a valid status." }),
});

const stockSchema = z.coerce
  .number({ error: "Enter a whole number." })
  .int("Enter a whole number.")
  .min(0, "Stock cannot be negative.")
  .max(MAX_STOCK, `Stock cannot exceed ${MAX_STOCK.toLocaleString("en-US")}.`);

/**
 * Validates an edit against the product being edited. Every existing variant must be
 * present exactly once (variants cannot be added or removed here), prices must be exact
 * minor-unit amounts, and a compare-at price must be higher than the price.
 */
export function parseProductEdit(raw: RawProductEdit, product: Product): ParseEditResult {
  const errors: Record<string, string> = {};

  const text = textFields.safeParse(raw);
  if (!text.success) {
    for (const issue of text.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
  }

  const expectedIds = product.variants.map((v) => v.id).sort();
  const submittedIds = raw.variants.map((v) => v.id).sort();
  if (expectedIds.join("|") !== submittedIds.join("|")) {
    errors.form = "The variants changed since this page was loaded. Reload and try again.";
  }

  const variants: VariantEdit[] = [];
  for (const input of raw.variants) {
    const current = product.variants.find((v) => v.id === input.id);
    if (!current) continue;
    const currency = current.price.currency;

    const price = parseMoneyInput(input.price, currency);
    if (!price || price.amountMinor === 0) {
      errors[`${input.id}.price`] = "Enter a price above $0.00 with up to two decimals.";
    }

    let compareAtPrice: Money | null = null;
    if (input.compareAt.trim() !== "") {
      compareAtPrice = parseMoneyInput(input.compareAt, currency);
      if (!compareAtPrice) {
        errors[`${input.id}.compareAt`] =
          "Enter an amount with up to two decimals, or leave blank.";
      } else if (price && compareAtPrice.amountMinor <= price.amountMinor) {
        errors[`${input.id}.compareAt`] = "Compare-at price must be higher than the price.";
      }
    }

    const stock = stockSchema.safeParse(input.stock.trim() === "" ? Number.NaN : input.stock);
    if (!stock.success) {
      errors[`${input.id}.stock`] = stock.error.issues[0]?.message ?? "Enter a whole number.";
    }

    if (price && stock.success) {
      variants.push({
        id: input.id,
        price,
        compareAtPrice,
        inventoryQuantity: stock.data,
      });
    }
  }

  if (Object.keys(errors).length > 0 || !text.success) return { ok: false, errors };
  return { ok: true, edit: { ...text.data, variants } };
}

export interface AuditChange {
  readonly entityType: "product" | "variant";
  readonly entityId: string;
  /** Human label for the audit log: product handle or variant SKU. */
  readonly label: string;
  readonly field: string;
  readonly before: string;
  readonly after: string;
}

const moneyText = (value: Money | null) => (value ? toDecimalString(value) : "");

/** Every field the edit actually changes, in a stable order. Unchanged fields are omitted. */
export function diffProductEdit(product: Product, edit: ProductEdit): AuditChange[] {
  const changes: AuditChange[] = [];
  const productField = (field: string, before: string, after: string) => {
    if (before !== after) {
      changes.push({
        entityType: "product",
        entityId: product.id,
        label: product.handle,
        field,
        before,
        after,
      });
    }
  };
  productField("title", product.title, edit.title);
  productField("summary", product.summary, edit.summary);
  productField("description", product.description, edit.description);
  productField("status", product.status, edit.status);

  for (const current of product.variants) {
    const next = edit.variants.find((v) => v.id === current.id);
    if (!next) continue;
    const variantField = (field: string, before: string, after: string) => {
      if (before !== after) {
        changes.push({
          entityType: "variant",
          entityId: current.id,
          label: current.sku,
          field,
          before,
          after,
        });
      }
    };
    variantField("price", moneyText(current.price), moneyText(next.price));
    variantField(
      "compareAtPrice",
      moneyText(current.compareAtPrice),
      moneyText(next.compareAtPrice),
    );
    variantField(
      "inventoryQuantity",
      String(current.inventoryQuantity),
      String(next.inventoryQuantity),
    );
  }
  return changes;
}

/** Converts a stored Money back to the shape used by forms; exported for the editor UI. */
export function formMoney(value: Money | null): string {
  return value ? toDecimalString(value) : "";
}

/**
 * A canonical text form of a validated edit, bound to the product version it was made
 * against. A publish must match the edit the merchant previewed, so the server hashes this
 * at preview time and compares it again at publish time.
 */
export function canonicalEdit(
  productId: string,
  expectedUpdatedAt: string,
  edit: ProductEdit,
): string {
  return JSON.stringify([
    productId,
    expectedUpdatedAt,
    edit.title,
    edit.summary,
    edit.description,
    edit.status,
    edit.variants.map((v) => [
      v.id,
      v.price.amountMinor,
      v.price.currency,
      v.compareAtPrice?.amountMinor ?? null,
      v.compareAtPrice?.currency ?? null,
      v.inventoryQuantity,
    ]),
  ]);
}

/** Merchant-facing names for the fields in an `AuditChange`. */
export const CHANGE_FIELD_LABELS: Readonly<Record<string, string>> = {
  title: "Title",
  summary: "Summary",
  description: "Description",
  status: "Status",
  price: "Price",
  compareAtPrice: "Compare-at price",
  inventoryQuantity: "Stock",
};

/**
 * What shoppers will see differently once the edit is published, using the same rules as
 * the storefront: a product is listed only while active, a variant is sold out at zero
 * stock, and it shows as reduced when its compare-at price is above its price.
 */
export function storefrontEffects(product: Product, edit: ProductEdit): string[] {
  const effects: string[] = [];
  const wasListed = product.status === "active";
  const willBeListed = edit.status === "active";
  if (wasListed && !willBeListed) effects.push("The product will be hidden from the store.");
  if (!wasListed && willBeListed) effects.push("The product will be listed in the store.");

  for (const current of product.variants) {
    const next = edit.variants.find((v) => v.id === current.id);
    if (!next) continue;
    if (current.inventoryQuantity > 0 && next.inventoryQuantity <= 0) {
      effects.push(`${current.sku} will show as sold out.`);
    }
    if (current.inventoryQuantity <= 0 && next.inventoryQuantity > 0) {
      effects.push(`${current.sku} will be back in stock.`);
    }
    const before = priceDisplay(current);
    const after = priceDisplay({ price: next.price, compareAtPrice: next.compareAtPrice });
    if (after.compareAt && after.compareAt !== before.compareAt) {
      effects.push(`${current.sku} will show as reduced from ${after.compareAt}.`);
    }
    if (before.compareAt && !after.compareAt) {
      effects.push(`${current.sku} will no longer show as reduced.`);
    }
  }
  return effects;
}
