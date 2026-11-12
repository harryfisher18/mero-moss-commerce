"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { type DemoResetState, resetDemoStoreAction } from "@/app/admin/actions";
import { RESET_CONFIRMATION } from "@/domain/merchant/settings";

const initialState: DemoResetState = { status: "idle", message: "" };

/** Rendered only while the public demo login is active. The server checks again. */
export function DemoResetForm() {
  const [state, action, pending] = useActionState(resetDemoStoreAction, initialState);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="mt-3 space-y-3" data-testid="demo-reset">
      <label htmlFor="reset-confirmation" className="block text-sm">
        Type <strong>{RESET_CONFIRMATION}</strong> to confirm
      </label>
      <input
        id="reset-confirmation"
        name="confirmation"
        autoComplete="off"
        className="min-h-11 w-full max-w-sm rounded-sm border border-line bg-white px-3 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-full border border-clay px-4 text-sm font-medium text-clay hover:bg-clay/10 disabled:opacity-60"
      >
        {pending ? "Resetting…" : "Reset demo store"}
      </button>
      <p
        role="status"
        aria-live="polite"
        data-testid="demo-reset-status"
        className={`min-h-5 text-sm ${state.status === "error" ? "text-clay" : "text-moss"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
