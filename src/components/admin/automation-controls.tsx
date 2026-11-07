"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { type AutomationActionState, runDueJobs, startAutomationDrill } from "@/app/admin/actions";

const initialState: AutomationActionState = { status: "idle", message: "" };

const secondaryButton =
  "rounded-full border border-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-paper disabled:opacity-60";

/** "Run due jobs" plus the two labelled failure drills. The server re-checks every action. */
export function AutomationControls() {
  const router = useRouter();
  const [runState, runAction, running] = useActionState(runDueJobs, initialState);
  const [drillState, drillAction, drilling] = useActionState(startAutomationDrill, initialState);
  useEffect(() => {
    if (runState.status === "success") router.refresh();
  }, [runState, router]);

  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="automation-controls">
      <section
        aria-labelledby="worker-heading"
        className="rounded-sm border border-line bg-white p-4"
      >
        <h2 id="worker-heading" className="font-medium">
          Worker
        </h2>
        <p className="mt-1 text-sm text-muted">
          New orders are processed right after checkout. Scheduled retries run when the worker next
          polls (<code>npm run worker</code>) or when you run due jobs here.
        </p>
        <form action={runAction} className="mt-3">
          <button
            type="submit"
            disabled={running}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-moss disabled:opacity-60"
          >
            {running ? "Running…" : "Run due jobs"}
          </button>
          <p
            role="status"
            aria-live="polite"
            data-testid="run-status"
            className={`mt-2 min-h-5 text-xs ${runState.status === "error" ? "text-clay" : "text-moss"}`}
          >
            {runState.message}
          </p>
        </form>
      </section>

      <section
        aria-labelledby="drills-heading"
        className="rounded-sm border border-line bg-white p-4"
      >
        <h2 id="drills-heading" className="font-medium">
          Failure drills <span className="text-xs font-normal text-muted">(demo)</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          A drill is a labelled test event whose handler fails on purpose, so you can watch retries
          and the dead letter queue. Drills have no side effects.
        </p>
        <form action={drillAction} className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            name="scenario"
            value="recovers"
            disabled={drilling}
            className={secondaryButton}
          >
            Start retry drill
          </button>
          <button
            type="submit"
            name="scenario"
            value="always_fails"
            disabled={drilling}
            className={secondaryButton}
          >
            Start dead-letter drill
          </button>
        </form>
        {drillState.status === "error" && (
          <p role="alert" className="mt-2 text-xs text-clay">
            {drillState.message}
          </p>
        )}
      </section>
    </div>
  );
}
