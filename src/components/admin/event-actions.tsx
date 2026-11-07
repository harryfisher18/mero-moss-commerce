"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { type AutomationActionState, operateEvent } from "@/app/admin/actions";

const initialState: AutomationActionState = { status: "idle", message: "" };

/** Operator actions for one outbox event. Only the actions its status allows are rendered. */
export function EventActions({
  eventId,
  canReplay,
  canRetry,
}: {
  eventId: string;
  canReplay: boolean;
  canRetry: boolean;
}) {
  const [state, formAction, pending] = useActionState(operateEvent, initialState);
  const router = useRouter();
  useEffect(() => {
    if (state.status !== "idle") router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-2" data-testid="event-actions">
      <input type="hidden" name="eventId" value={eventId} />
      {canRetry && (
        <button
          type="submit"
          name="operation"
          value="retry_now"
          disabled={pending}
          className="block w-full rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-moss disabled:opacity-60"
        >
          Retry now
        </button>
      )}
      {canReplay && (
        <>
          <button
            type="submit"
            name="operation"
            value="replay"
            disabled={pending}
            className="block w-full rounded-full border border-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-paper disabled:opacity-60"
          >
            Replay event
          </button>
          <p className="text-xs text-muted">
            Replaying re-runs the handler with the same event ID. Effects already applied are not
            created again.
          </p>
        </>
      )}
      {!canRetry && !canReplay && (
        <p className="text-sm text-muted">No actions are available for this event.</p>
      )}
      <p
        role="status"
        aria-live="polite"
        data-testid="event-action-status"
        className={`min-h-5 text-xs ${state.status === "error" ? "text-clay" : "text-moss"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
