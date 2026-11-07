"use client";

import { useActionState } from "react";
import { type CartActionState, updateCartLine } from "@/app/(store)/cart/actions";
import { useRefreshOnSuccess } from "./use-refresh-on-success";

const initialState: CartActionState = { status: "idle", message: "" };

export function CartLineControls({
  variantId,
  productTitle,
  quantity,
  maxQuantity,
}: {
  variantId: string;
  productTitle: string;
  quantity: number;
  maxQuantity: number;
}) {
  const [state, formAction, pending] = useActionState(updateCartLine, initialState);
  useRefreshOnSuccess(state);
  const inputId = `qty-${variantId}`;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="variantId" value={variantId} />
      {maxQuantity > 0 && (
        <>
          <div>
            <label htmlFor={inputId} className="block text-xs text-muted">
              Quantity<span className="sr-only"> for {productTitle}</span>
            </label>
            <input
              key={quantity}
              id={inputId}
              name="quantity"
              type="number"
              inputMode="numeric"
              min={0}
              max={maxQuantity}
              defaultValue={quantity}
              required
              className="mt-1 w-20 rounded-sm border border-line bg-paper px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            name="intent"
            value="update"
            disabled={pending}
            className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink disabled:opacity-60"
          >
            Update<span className="sr-only"> quantity for {productTitle}</span>
          </button>
        </>
      )}
      <button
        type="submit"
        name="intent"
        value="remove"
        formNoValidate
        disabled={pending}
        className="px-2 py-2 text-sm underline underline-offset-2 hover:text-clay disabled:opacity-60"
      >
        Remove<span className="sr-only"> {productTitle}</span>
      </button>
      <p
        role="status"
        aria-live="polite"
        className={`basis-full text-xs ${state.status === "error" ? "text-clay" : "text-moss"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
