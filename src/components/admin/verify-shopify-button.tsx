"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { type IntegrationActionState, verifyShopifyConnection } from "@/app/admin/actions";

const initialState: IntegrationActionState = { status: "idle", message: "" };

/** Rendered only when a complete Shopify configuration exists to be checked. */
export function VerifyShopifyButton() {
  const [state, action, pending] = useActionState(verifyShopifyConnection, initialState);
  const router = useRouter();
  useEffect(() => {
    if (state.status !== "idle") router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="mt-3">
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-full border border-ink px-4 text-sm font-medium hover:bg-ink hover:text-paper disabled:opacity-60"
      >
        {pending ? "Checking…" : "Verify connection (read-only)"}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={`mt-2 min-h-5 text-sm ${state.status === "error" ? "text-clay" : "text-moss"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
