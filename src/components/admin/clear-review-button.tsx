"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { clearOrderReview, type TransitionState } from "@/app/admin/actions";

const initialState: TransitionState = { status: "idle", message: "" };

/** Records that a person checked a held order, which releases it for processing. */
export function ClearReviewButton({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(clearOrderReview, initialState);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-moss disabled:opacity-60"
      >
        {pending ? "Saving…" : "Mark as reviewed"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-clay">
          {state.message}
        </p>
      )}
    </form>
  );
}
