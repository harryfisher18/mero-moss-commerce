"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { type ProductEditPreview, type ProductEditState, saveProduct } from "@/app/admin/actions";
import type { Product } from "@/domain/commerce/catalog";
import {
  CHANGE_FIELD_LABELS,
  formMoney,
  PRODUCT_STATUSES,
  type RawProductEdit,
} from "@/domain/commerce/product-edit";

const initialState: ProductEditState = {
  status: "idle",
  message: "",
  errors: {},
  values: null,
  preview: null,
};

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
  // Editing any field after a preview withdraws it: only a previewed edit can be published.
  const [editedAfter, setEditedAfter] = useState<ProductEditState | null>(null);
  const preview = state.preview && editedAfter !== state ? state.preview : null;
  const previewWithdrawn = state.preview !== null && editedAfter === state;
  // React resets the form after each action. A <select> resets to the default it was first
  // mounted with, not the echoed value, so it is remounted for every new result.
  const [lastState, setLastState] = useState(state);
  const [resultCount, setResultCount] = useState(0);
  if (lastState !== state) {
    setLastState(state);
    setResultCount((count) => count + 1);
  }

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
        onChange={() => {
          if (state.preview) setEditedAfter(state);
        }}
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
              key={resultCount}
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
            name="intent"
            value="preview"
            disabled={pending}
            className={`rounded-full px-6 py-3 text-sm font-medium disabled:opacity-60 ${
              preview
                ? "border border-ink text-ink hover:bg-ink/5"
                : "bg-ink text-paper hover:bg-moss"
            }`}
          >
            {preview ? "Preview again" : "Preview changes"}
          </button>
          <p className="text-xs text-muted">
            Demo catalog only. Nothing reaches the storefront until you publish, and every published
            change is recorded in the change history.
          </p>
        </div>
        {previewWithdrawn && (
          <p className="text-sm text-clay" data-testid="preview-withdrawn">
            You edited the form after previewing. Preview again to publish.
          </p>
        )}
        {preview && <PreviewPanel preview={preview} pending={pending} />}
      </form>
    </div>
  );
}

function PreviewPanel({ preview, pending }: { preview: ProductEditPreview; pending: boolean }) {
  const count = preview.changes.length;
  return (
    <section
      aria-labelledby="preview-heading"
      className="rounded-sm border border-moss bg-white p-5"
      data-testid="edit-preview"
    >
      <input type="hidden" name="previewFingerprint" value={preview.fingerprint} />
      <h2 id="preview-heading" className="font-medium">
        Review before publishing
      </h2>
      <ul className="mt-3 divide-y divide-line text-sm">
        {preview.changes.map((change) => (
          <li
            key={`${change.entityId}.${change.field}`}
            className="py-2"
            data-testid="preview-change"
          >
            <p className="text-xs text-muted">
              {change.entityType === "product" ? "Product" : change.label} ·{" "}
              {CHANGE_FIELD_LABELS[change.field] ?? change.field}
            </p>
            <p className="mt-1 break-words whitespace-pre-wrap">
              <span className="text-muted line-through">{change.before || "(none)"}</span>
              <span aria-hidden="true"> → </span>
              <span className="sr-only"> changes to </span>
              <span>{change.after || "(none)"}</span>
            </p>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 text-sm font-medium">What shoppers will see</h3>
      {preview.effects.length > 0 ? (
        <ul className="mt-1 list-disc pl-5 text-sm" data-testid="preview-effects">
          {preview.effects.map((effect) => (
            <li key={effect}>{effect}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted" data-testid="preview-effects">
          The new values, with no change to whether the product or its options are available.
        </p>
      )}
      <button
        type="submit"
        name="intent"
        value="publish"
        disabled={pending}
        className="mt-5 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-moss disabled:opacity-60"
      >
        {pending ? "Publishing…" : `Publish ${String(count)} ${count === 1 ? "change" : "changes"}`}
      </button>
    </section>
  );
}
