"use client";

import { useActionState } from "react";
import { type CartReminderState, requestCartReminder } from "@/app/(store)/cart/actions";

const initialState: CartReminderState = { status: "idle", message: "", errors: {}, email: "" };

/** An explicit opt-in. The box starts unticked and is never ticked for the shopper. */
export function CartReminderForm() {
  const [state, action, pending] = useActionState(requestCartReminder, initialState);
  return (
    <form
      action={action}
      noValidate
      className="mt-6 space-y-2 border-t border-line pt-4 text-sm"
      data-testid="cart-reminder"
    >
      <p className="font-medium">Not ready yet?</p>
      <label htmlFor="reminder-email" className="block text-xs text-muted">
        Email for a reminder
      </label>
      <input
        id="reminder-email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.email}
        aria-invalid={state.errors.email ? true : undefined}
        aria-describedby={state.errors.email ? "reminder-email-error" : undefined}
        className="w-full rounded-sm border border-line bg-white px-3 py-2 aria-[invalid=true]:border-clay"
      />
      {state.errors.email && (
        <p id="reminder-email-error" className="text-xs text-clay">
          {state.errors.email}
        </p>
      )}
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          name="consent"
          value="yes"
          aria-invalid={state.errors.consent ? true : undefined}
          aria-describedby={state.errors.consent ? "reminder-consent-error" : undefined}
          className="mt-0.5"
        />
        <span>Email me about this cart and new pieces. I can opt out at any time.</span>
      </label>
      {state.errors.consent && (
        <p id="reminder-consent-error" className="text-xs text-clay">
          {state.errors.consent}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-ink px-4 py-2 font-medium hover:bg-ink hover:text-paper disabled:opacity-60"
      >
        {pending ? "Saving…" : "Remind me"}
      </button>
      <p
        role="status"
        aria-live="polite"
        data-testid="cart-reminder-status"
        className={`min-h-5 text-xs ${state.status === "error" ? "text-clay" : "text-moss"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
