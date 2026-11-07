import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventActions } from "@/components/admin/event-actions";
import { EventStatusBadge } from "@/components/admin/event-status-badge";
import { EVENT_TYPE_LABELS, OUTCOME_LABELS, TRIGGER_LABELS } from "@/domain/events/outbox";
import {
  NOTIFICATION_KIND_LABELS,
  orderCreatedPayloadSchema,
  redactPayload,
  redactRecipient,
  tagLabel,
} from "@/domain/events/order-created";
import { automationService } from "@/server/automation";
import { requireMerchant } from "@/server/merchant-session";
import type { OutboxEvent } from "@/server/repositories/automation-repository";

export const metadata: Metadata = { title: "Automation event" };

const timeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "UTC",
});
const formatTime = (iso: string) => `${timeFormat.format(new Date(iso))} UTC`;

export default function AutomationEventPage({ params }: PageProps<"/admin/automations/[id]">) {
  return (
    <>
      <Link href="/admin/automations" className="text-sm text-muted hover:text-ink hover:underline">
        ← All automation events
      </Link>
      <Suspense fallback={<p className="mt-8 text-muted">Loading event…</p>}>
        <EventDetail params={params} />
      </Suspense>
    </>
  );
}

/** The payload as shown to merchants: personal data masked, invalid payloads withheld. */
function displayPayload(event: OutboxEvent): string {
  if (event.type === "order.created") {
    const parsed = orderCreatedPayloadSchema.safeParse(event.payload);
    return parsed.success
      ? JSON.stringify(redactPayload(parsed.data), null, 2)
      : "This payload failed validation, so it is not displayed.";
  }
  return JSON.stringify(event.payload, null, 2);
}

async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireMerchant();
  const { id } = await params;
  const detail = automationService().detail(id);
  if (!detail) notFound();
  const { event, attempts, previews, tags } = detail;
  const isOrder = event.type === "order.created";

  return (
    <article className="mt-4" data-testid="event-detail">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl">{event.subject}</h1>
        <EventStatusBadge status={event.status} attempts={event.attempts} />
      </div>
      <p className="mt-1 text-sm text-muted">{EVENT_TYPE_LABELS[event.type]}</p>

      {event.status === "dead" && (
        <div
          role="note"
          className="mt-4 rounded-sm border border-clay bg-clay/10 p-4 text-sm"
          data-testid="dead-letter-notice"
        >
          <p className="font-medium">Automatic retries stopped after {event.attempts} attempts.</p>
          <p className="mt-1">
            Check the last error below. Once the cause is fixed, use Retry now to try the event
            again.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-8">
          {isOrder && (
            <section
              aria-labelledby="routing-heading"
              className="rounded-sm border border-line bg-white p-4"
            >
              <h2 id="routing-heading" className="font-medium">
                Routing and review
              </h2>
              {tags.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No tags yet. The event has not succeeded.</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2" data-testid="event-tags">
                  {tags.map((tag) => (
                    <li
                      key={tag.tag}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        tag.tag.startsWith("review:")
                          ? "bg-clay/15 text-clay"
                          : "bg-moss/15 text-moss"
                      }`}
                    >
                      {tagLabel(tag.tag)}
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={`/admin/orders/${event.aggregateId}`}
                className="mt-3 inline-block text-sm underline underline-offset-2"
              >
                Open order {event.subject}
              </Link>
            </section>
          )}

          {isOrder && (
            <section aria-labelledby="previews-heading">
              <h2 id="previews-heading" className="font-medium">
                Notification previews
              </h2>
              {previews.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No previews recorded yet.</p>
              ) : (
                <ul className="mt-3 space-y-4" data-testid="notification-previews">
                  {previews.map((preview) => (
                    <li
                      key={preview.kind}
                      className="rounded-sm border border-line bg-white p-4 text-sm"
                      data-testid="notification-preview"
                      data-kind={preview.kind}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{NOTIFICATION_KIND_LABELS[preview.kind]}</p>
                        <span className="rounded-full border border-clay px-2 py-0.5 text-xs text-clay uppercase">
                          Preview only · not sent
                        </span>
                      </div>
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-xs">
                        <dt className="text-muted">To</dt>
                        <dd>{redactRecipient(preview.recipient)}</dd>
                        <dt className="text-muted">Subject</dt>
                        <dd>{preview.subject}</dd>
                      </dl>
                      <pre className="mt-3 overflow-x-auto rounded-sm bg-paper p-3 font-sans text-xs whitespace-pre-wrap">
                        {preview.body}
                      </pre>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section aria-labelledby="payload-heading">
            <h2 id="payload-heading" className="font-medium">
              Payload
            </h2>
            {isOrder && (
              <p className="mt-1 text-xs text-muted">
                Personal data is masked here. The street address is never part of the event.
              </p>
            )}
            <pre
              className="mt-2 max-h-96 overflow-auto rounded-sm border border-line bg-white p-3 text-xs"
              data-testid="event-payload"
            >
              {displayPayload(event)}
            </pre>
          </section>
        </div>

        <div className="space-y-6">
          <section
            aria-labelledby="actions-heading"
            className="rounded-sm border border-line bg-white p-4"
          >
            <h2 id="actions-heading" className="mb-3 font-medium">
              Operator actions
            </h2>
            <EventActions
              eventId={event.id}
              canRetry={event.status !== "succeeded"}
              canReplay={event.status === "succeeded" && isOrder}
            />
          </section>

          <section
            aria-labelledby="facts-heading"
            className="rounded-sm border border-line bg-white p-4 text-sm"
          >
            <h2 id="facts-heading" className="font-medium">
              Details
            </h2>
            <dl className="mt-2 space-y-2">
              <div>
                <dt className="text-xs text-muted">Event ID (idempotency key)</dt>
                <dd className="font-mono text-xs break-all" data-testid="event-id">
                  {event.id}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Created</dt>
                <dd>{formatTime(event.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Attempts</dt>
                <dd data-testid="event-attempts">
                  {event.attempts} of {event.maxAttempts}
                </dd>
              </div>
              {event.status === "pending" && (
                <div>
                  <dt className="text-xs text-muted">Next attempt</dt>
                  <dd>{formatTime(event.nextAttemptAt)}</dd>
                </div>
              )}
              {event.processedAt && (
                <div>
                  <dt className="text-xs text-muted">
                    {event.status === "dead" ? "Dead-lettered" : "Completed"}
                  </dt>
                  <dd>{formatTime(event.processedAt)}</dd>
                </div>
              )}
              {event.lastError && (
                <div>
                  <dt className="text-xs text-muted">Last error</dt>
                  <dd className="text-clay" data-testid="event-last-error">
                    {event.lastError}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section
            aria-labelledby="attempts-heading"
            className="rounded-sm border border-line bg-white p-4 text-sm"
          >
            <h2 id="attempts-heading" className="font-medium">
              Attempt log
            </h2>
            {attempts.length === 0 ? (
              <p className="mt-2 text-muted">Not attempted yet.</p>
            ) : (
              <ol className="mt-2 space-y-3" data-testid="attempt-log">
                {attempts.map((attempt, index) => (
                  <li key={index} data-outcome={attempt.outcome}>
                    <span className="font-medium">{OUTCOME_LABELS[attempt.outcome]}</span>
                    <span className="block text-xs text-muted">
                      {formatTime(attempt.createdAt)} · {TRIGGER_LABELS[attempt.trigger]}
                    </span>
                    {attempt.detail && <span className="block text-xs">{attempt.detail}</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}
