"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { type ProductEditState, saveProduct } from "@/app/admin/actions";
import type { Product } from "@/domain/commerce/catalog";
import { formMoney, PRODUCT_STATUSES, type RawProductEdit } from "@/domain/commerce/product-edit";

const initialState: ProductEditState = { status: "idle", message: "", errors: {}, values: null };

const STATUS_LABELS: Record<(typeof PRODUCT_STATUSES)[number], string> = {
  active: "Active (visible in the store)",
  draft: "Draft (hidden from the store)",
  archived: "Archived (hidden from the store)",
};

const inputClass =
  "mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm aria-[invalid=true]:border-clay";

function fromProduct(product: Product): RawProductEdit {
  return {
    title: product.title,
    summary: product.summary,
    description: product.description,
    status: product.status,
    variants: product.variants.map((v) => ({
      id: v.id,
      price: formMoney(v.price),
      compareAt: formMoney(v.compareAtPrice),
      stock: String(v.inventoryQuantity),
    })),
  };
}

export function ProductEditor({ product }: { product: Product }) {
  const [state, formAction, pending] = useActionState(saveProduct, initialState);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  const values = state.values ?? fromProduct(product);
  const error = (key: string) => state.errors[key];
  const describe = (key: string) =>
    error(key) ? { "aria-invalid": true, "aria-describedby": `${key}-error` } : {};
  const errorText = (key: string) =>
    error(key) ? (
      <p id={`${key}-error`} className="mt-1 text-xs text-clay">
        {error(key)}
      </p>
    ) : null;

  return (
    <div>
      <p
        role="status"
        aria-live="polite"
        data-testid="editor-status"
        className={`min-h-6 text-sm ${state.status === "error" ? "text-clay" : "text-moss"}`}
      >
        {state.message}
      </p>
      {error("form") && (
        <p role="alert" className="mb-4 text-sm text-clay">
          {error("form")}
        </p>
      )}

      {/* Remount after each successful save so defaults and updatedAt come from the server. */}
      <form
        key={product.updatedAt}
        action={formAction}
        className="space-y-8"
        data-testid="product-editor"
      >
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="expectedUpdatedAt" value={product.updatedAt} />

        <fieldset className="space-y-4 rounded-sm border border-line bg-white p-5">
          <legend className="px-1 font-medium">Details</legend>
          <div>
            <label htmlFor="title" className="block text-sm font-medium">
              Title
            </label>
            <input
              id="title"
              name="title"
              defaultValue={values.title}
              className={inputClass}
              {...describe("title")}
            />
            {errorText("title")}
          </div>
          <div>
            <label htmlFor="summary" className="block text-sm font-medium">
              Summary
            </label>
            <input
              id="summary"
              name="summary"
              defaultValue={values.summary}
              className={inputClass}
              {...describe("summary")}
            />
            {errorText("summary")}
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={values.description}
              className={inputClass}
              {...describe("description")}
            />
            {errorText("description")}
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={values.status}
              className={inputClass}
              {...describe("status")}
            >
              {PRODUCT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            {errorText("status")}
          </div>
        </fieldset>

        <fieldset className="rounded-sm border border-line bg-white p-5">
          <legend className="px-1 font-medium">Variants, pricing and stock</legend>
          <div className="space-y-6">
            {product.variants.map((variant) => {
              const value = values.variants.find((v) => v.id === variant.id);
              const key = (field: string) => `${variant.id}.${field}`;
              const id = (field: string) => `${variant.id}-${field}`;
              return (
                <div
                  key={variant.id}
                  className="grid gap-3 border-b border-line pb-5 last:border-0 last:pb-0 sm:grid-cols-[1fr_8rem_8rem_7rem]"
                  data-testid="variant-row"
                  data-sku={variant.sku}
                >
                  <input type="hidden" name="variantId" value={variant.id} />
                  <div>
                    <p className="text-sm font-medium">{variant.title}</p>
                    <p className="text-xs text-muted">SKU {variant.sku}</p>
                  </div>
                  <div>
                    <label htmlFor={id("price")} className="block text-xs text-muted">
                      Price (USD)<span className="sr-only"> for {variant.sku}</span>
                    </label>
                    <input
                      id={id("price")}
                      name="price"
                      inputMode="decimal"
                      defaultValue={value?.price}
                      className={inputClass}
                      {...describe(key("price"))}
                    />
                    {errorText(key("price"))}
                  </div>
                  <div>
                    <label htmlFor={id("compareAt")} className="block text-xs text-muted">
                      Compare-at<span className="sr-only"> for {variant.sku}</span>
                    </label>
                    <input
                      id={id("compareAt")}
                      name="compareAt"
                      inputMode="decimal"
                      placeholder="Optional"
                      defaultValue={value?.compareAt}
                      className={inputClass}
                      {...describe(key("compareAt"))}
                    />
                    {errorText(key("compareAt"))}
                  </div>
                  <div>
                    <label htmlFor={id("stock")} className="block text-xs text-muted">
                      Stock<span className="sr-only"> for {variant.sku}</span>
                    </label>
                    <input
                      id={id("stock")}
                      name="stock"
                      inputMode="numeric"
                      defaultValue={value?.stock}
                      className={inputClass}
                      {...describe(key("stock"))}
                    />
                    {errorText(key("stock"))}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-moss disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          <p className="text-xs text-muted">
            Demo catalog only. Changes apply to the storefront immediately and are recorded in the
            change history.
          </p>
        </div>
      </form>
    </div>
  );
}
