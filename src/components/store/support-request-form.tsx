"use client";

import { useActionState } from "react";
import { requestHelp, type SupportFormState } from "@/app/(store)/advisor/actions";

const initialState: SupportFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  values: { email: "", message: "" },
  requestId: null,
};

const inputClass =
  "mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm aria-[invalid=true]:border-clay";

/** Human escalation from the advisor. The question that led here is sent as context. */
export function SupportRequestForm({ question }: { question: string }) {
  const [state, formAction, pending] = useActionState(requestHelp, initialState);
  const error = state.fieldErrors;

  return (
    <form
      action={formAction}
      // Remount after a successful send so the fields clear.
      key={state.requestId ?? "form"}
      className="space-y-4"
      data-testid="support-form"
      noValidate
    >
      <input type="hidden" name="question" value={question} />
      <div>
        <label htmlFor="support-email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="support-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values.email}
          className={inputClass}
          aria-invalid={error.email ? true : undefined}
          aria-describedby={error.email ? "support-email-error" : undefined}
        />
        {error.email && (
          <p id="support-email-error" className="mt-1 text-xs text-clay">
            {error.email}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="support-message" className="block text-sm font-medium">
          How can we help?
        </label>
        <textarea
          id="support-message"
          name="message"
          rows={4}
          required
          maxLength={2000}
          defaultValue={state.values.message}
          className={inputClass}
          aria-invalid={error.message ? true : undefined}
          aria-describedby={error.message ? "support-message-error" : undefined}
        />
        {error.message && (
          <p id="support-message-error" className="mt-1 text-xs text-clay">
            {error.message}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-moss disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send to our team"}
      </button>
      <p
        role="status"
        aria-live="polite"
        data-testid="support-status"
        className={`min-h-5 text-sm ${state.status === "error" ? "text-clay" : "text-moss"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
