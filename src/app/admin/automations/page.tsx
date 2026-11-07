import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AutomationControls } from "@/components/admin/automation-controls";
import { EventStatusBadge } from "@/components/admin/event-status-badge";
import {
  DISPLAY_STATUS_LABELS,
  EVENT_FILTERS,
  EVENT_TYPE_LABELS,
  type EventFilter,
} from "@/domain/events/outbox";
import { formatDelay, RETRY_POLICY, retrySchedule } from "@/domain/events/retry-policy";
import { automationService } from "@/server/automation";
import { requireMerchant } from "@/server/merchant-session";

export const metadata: Metadata = { title: "Automations" };

const timeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "UTC",
});

export default function AutomationsPage({ searchParams }: PageProps<"/admin/automations">) {
  return (
    <>
      <h1 className="font-serif text-3xl">Automations</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Every order writes an <code>order.created</code> event in the same database transaction as
        the order. A worker routes it to a ship zone, flags it for review when needed and records
        notification previews. Nothing is sent: live notifications are off in this demo.
      </p>
      <dl className="mt-4 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">Retry policy</dt>
        <dd>
          Up to {RETRY_POLICY.maxAttempts} attempts. Retries wait{" "}
          {retrySchedule().map(formatDelay).join(", ")}, then the event moves to the dead letter
          queue.
        </dd>
        <dt className="text-muted">Idempotency</dt>
        <dd>Effects are keyed by event ID, so replaying an event never applies them twice.</dd>
        <dt className="text-muted">Live sends</dt>
        <dd>Off. Notifications are stored as previews only.</dd>
      </dl>
      <Suspense fallback={<p className="mt-8 text-muted">Loading jobs…</p>}>
        <JobLog searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function JobLog({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireMerchant();
  const { status: raw } = await searchParams;
  const filter: EventFilter = EVENT_FILTERS.find((f) => f === raw && f !== "all") ?? "all";
  const service = automationService();
  const counts = service.counts();
  const events = service.list(filter);

  return (
    <>
      <div className="mt-6">
        <AutomationControls />
      </div>

      <nav aria-label="Filter by status" className="mt-8">
        <ul className="flex flex-wrap gap-2 text-sm">
          {EVENT_FILTERS.map((value) => {
            const current = value === filter;
            return (
              <li key={value}>
                <Link
                  href={
                    value === "all" ? "/admin/automations" : `/admin/automations?status=${value}`
                  }
                  aria-current={current ? "page" : undefined}
                  className={`inline-block rounded-full border px-3 py-1 ${
                    current ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
                  }`}
                >
                  {value === "all" ? "All" : DISPLAY_STATUS_LABELS[value]}{" "}
                  <span data-testid={`count-${value}`}>({counts[value]})</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {events.length === 0 ? (
        <div className="mt-6 rounded-sm border border-dashed border-line p-10 text-center">
          <p className="font-serif text-xl">
            No events {filter === "all" ? "yet" : "with this status"}.
          </p>
          <p className="mt-2 text-sm text-muted">
            Place a simulated order in the store, or start a failure drill above.
          </p>
          <Link href="/collections/all" className="mt-4 inline-block underline underline-offset-2">
            Open the storefront
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-sm border border-line bg-white">
          <table className="w-full min-w-[46rem] text-left text-sm" data-testid="events-table">
            <caption className="sr-only">Outbox events, newest first</caption>
            <thead className="border-b border-line bg-paper text-xs tracking-wide text-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Event
                </th>
                <th scope="col" className="px-4 py-3">
                  Created (UTC)
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Attempts
                </th>
                <th scope="col" className="px-4 py-3">
                  Next step
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {events.map((event) => (
                <tr key={event.id} data-testid="event-row" data-subject={event.subject}>
                  <th scope="row" className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/automations/${event.id}`}
                      className="underline underline-offset-2"
                    >
                      {event.subject}
                    </Link>
                    <span className="block text-xs font-normal text-muted">
                      {EVENT_TYPE_LABELS[event.type]}
                    </span>
                  </th>
                  <td className="px-4 py-3">{timeFormat.format(new Date(event.createdAt))}</td>
                  <td className="px-4 py-3">
                    <EventStatusBadge status={event.status} attempts={event.attempts} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {event.attempts} / {event.maxAttempts}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {event.status === "pending"
                      ? `Due ${timeFormat.format(new Date(event.nextAttemptAt))}`
                      : event.status === "dead"
                        ? "Needs operator action"
                        : "Done"}
                    {event.lastError && <span className="block text-clay">{event.lastError}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
