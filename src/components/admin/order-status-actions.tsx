"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { type TransitionState, transitionOrder } from "@/app/admin/actions";
import type { OrderStatus } from "@/domain/commerce/order";
import { STATUS_ACTION_LABELS } from "@/domain/commerce/order-status";

const initialState: TransitionState = { status: "idle", message: "" };

/** Buttons for the transitions the current status allows; the server re-validates each. */
export function OrderStatusActions({
  orderId,
  targets,
}: {
  orderId: string;
  targets: OrderStatus[];
}) {
  const [state, formAction, pending] = useActionState(transitionOrder, initialState);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  if (targets.length === 0) {
    return <p className="mt-2 text-sm text-muted">This order is closed. No further changes.</p>;
  }

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      {targets.map((to) => (
        <button
          key={to}
          type="submit"
          name="to"
          value={to}
          disabled={pending}
          className={`block w-full rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60 ${
            to === "cancelled"
              ? "border border-clay text-clay hover:bg-clay/10"
              : "bg-ink text-paper hover:bg-moss"
          }`}
        >
          {STATUS_ACTION_LABELS[to]}
        </button>
      ))}
      {targets.includes("cancelled") && (
        <p className="text-xs text-muted">Cancelling returns the ordered units to stock.</p>
      )}
      <p
        role="status"
        aria-live="polite"
        className={`min-h-5 text-xs ${state.status === "error" ? "text-clay" : "text-moss"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
