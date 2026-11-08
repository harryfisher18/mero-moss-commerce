import type { Metadata } from "next";
import { Suspense } from "react";
import { SweepButton, WithdrawConsentButton } from "@/components/admin/lifecycle-controls";
import { redactEmail } from "@/domain/events/order-created";
import { CONSENT_SOURCE_LABELS, JOURNEY_IDS, JOURNEYS } from "@/domain/lifecycle/journeys";
import { getDatabase } from "@/server/db/client";
import { LifecycleService } from "@/server/lifecycle-service";
import { requireMerchant } from "@/server/merchant-session";
import type { MessageStatus } from "@/server/repositories/lifecycle-repository";

export const metadata: Metadata = { title: "Lifecycle" };

const timeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const formatTime = (iso: string) => `${timeFormat.format(new Date(iso))} UTC`;

const STATUS_LABELS: Record<MessageStatus, string> = {
  previewed: "Preview only · not sent",
  skipped_no_consent: "Skipped: no consent",
  skipped_empty: "Skipped: nothing to show",
};

export default function LifecyclePage() {
  return (
    <>
      <h1 className="font-serif text-3xl">Lifecycle</h1>
      <p
        role="note"
        className="mt-4 max-w-3xl rounded-sm border border-clay bg-clay/5 p-3 text-sm"
        data-testid="lifecycle-disclaimer"
      >
        <strong>Previews only.</strong> No marketing email is ever sent from this store. A journey
        prepares a message only for someone who opted in, and only once per triggering event.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading journeys…</p>}>
        <Lifecycle />
      </Suspense>
    </>
  );
}

async function Lifecycle() {
  await requireMerchant();
  const { counts, records, consents } = new LifecycleService(getDatabase()).report();

  return (
    <>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {JOURNEY_IDS.map((id) => (
          <li
            key={id}
            className="rounded-sm border border-line bg-white p-4 text-sm"
            data-testid="journey"
            data-journey={id}
          >
            <h2 className="font-medium">{JOURNEYS[id].title}</h2>
            <p className="mt-1 text-muted">{JOURNEYS[id].trigger}</p>
            <p className="mt-1 text-muted">{JOURNEYS[id].dedupedBy}</p>
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 text-xs">
              <dt>Previewed</dt>
              <dd data-testid="journey-previewed">{counts[id].previewed}</dd>
              <dt>Skipped, no consent</dt>
              <dd>{counts[id].skipped_no_consent}</dd>
            </dl>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <SweepButton />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="messages-heading" className="min-w-0">
          <h2 id="messages-heading" className="font-medium">
            Recent journey decisions
          </h2>
          {records.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="mt-3 space-y-3" data-testid="lifecycle-messages">
              {records.map((record) => (
                <li
                  key={record.id}
                  className="rounded-sm border border-line bg-white p-4 text-sm"
                  data-testid="lifecycle-message"
                  data-journey={record.journey}
                  data-status={record.status}
                  data-reference={record.reference}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {JOURNEYS[record.journey].title} · {record.reference}
                    </p>
                    <span className="rounded-full border border-clay px-2 py-0.5 text-xs text-clay">
                      {STATUS_LABELS[record.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {record.email ? `To ${redactEmail(record.email)} · ` : ""}
                    {formatTime(record.createdAt)}
                  </p>
                  {record.subject && <p className="mt-2 text-xs">{record.subject}</p>}
                  {record.body && (
                    <pre className="mt-2 rounded-sm bg-paper p-3 font-sans text-xs whitespace-pre-wrap">
                      {record.body}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="consents-heading" className="min-w-0">
          <h2 id="consents-heading" className="font-medium">
            Marketing consent
          </h2>
          {consents.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No one has opted in yet.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm" data-testid="consents">
              {consents.map((consent) => (
                <li
                  key={consent.email}
                  className="rounded-sm border border-line bg-white p-3"
                  data-testid="consent"
                  data-email={consent.email}
                  data-status={consent.status}
                >
                  <p className="font-medium">{redactEmail(consent.email)}</p>
                  <p className="text-xs text-muted">
                    {consent.status === "granted" ? "Opted in" : "Withdrawn"} ·{" "}
                    {CONSENT_SOURCE_LABELS[consent.source]} · {formatTime(consent.grantedAt)}
                  </p>
                  {consent.status === "granted" && (
                    <div className="mt-2">
                      <WithdrawConsentButton
                        email={consent.email}
                        label={redactEmail(consent.email)}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
