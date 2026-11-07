"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addToCart, type CartActionState } from "@/app/(store)/cart/actions";
import { useRefreshOnSuccess } from "./use-refresh-on-success";

const initialState: CartActionState = { status: "idle", message: "" };

/**
 * Quantity + Add to cart for the selected variant. The quantity bound is only a hint for
 * the browser; the Server Action re-validates against live stock.
 */
export function AddToCartForm({
  variantId,
  maxQuantity,
}: {
  variantId: string;
  maxQuantity: number;
}) {
  const [state, formAction, pending] = useActionState(addToCart, initialState);
  useRefreshOnSuccess(state);

  return (
    <form action={formAction} className="mt-6" data-testid="add-to-cart">
      <input type="hidden" name="variantId" value={variantId} />
      <div className="flex items-end gap-3">
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium">
            Quantity
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={maxQuantity}
            defaultValue={1}
            required
            className="mt-1 w-20 rounded-sm border border-line bg-paper px-3 py-2.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-moss disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add to cart"}
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`mt-3 min-h-5 text-sm ${state.status === "error" ? "text-clay" : "text-moss"}`}
      >
        {state.message}
        {state.status === "success" && (
          <>
            {" "}
            <Link href="/cart" className="underline underline-offset-2">
              View cart
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
