"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import {
  type LifecycleActionState,
  sweepAbandonedCarts,
  withdrawMarketingConsent,
} from "@/app/admin/actions";

const initialState: LifecycleActionState = { status: "idle", message: "" };

function useRefresh(state: LifecycleActionState) {
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);
}

export function SweepButton() {
  const [state, action, pending] = useActionState(sweepAbandonedCarts, initialState);
  useRefresh(state);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-full border border-ink px-4 text-sm font-medium hover:bg-ink hover:text-paper disabled:opacity-60"
      >
        {pending ? "Checking…" : "Check for abandoned carts"}
      </button>
      <p role="status" aria-live="polite" className="text-sm text-moss" data-testid="sweep-status">
        {state.message}
      </p>
    </form>
  );
}

export function WithdrawConsentButton({ email, label }: { email: string; label: string }) {
  const [state, action, pending] = useActionState(withdrawMarketingConsent, initialState);
  useRefresh(state);
  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-full border border-clay px-3 text-xs font-medium text-clay hover:bg-clay/10 disabled:opacity-60"
      >
        Withdraw consent<span className="sr-only"> for {label}</span>
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-clay">
          {state.message}
        </p>
      )}
    </form>
  );
}
