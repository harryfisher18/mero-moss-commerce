import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatMoney } from "@/domain/commerce/money";
import { analyticsService } from "@/server/analytics";
import { requireMerchant } from "@/server/merchant-session";

export const metadata: Metadata = { title: "Analytics" };

const timeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const share = (value: number | null) => (value === null ? "–" : `${value.toFixed(1)}%`);

export default function AnalyticsPage() {
  return (
    <>
      <h1 className="font-serif text-3xl">Analytics</h1>
      <p
        role="note"
        className="mt-4 max-w-3xl rounded-sm border border-clay bg-clay/5 p-3 text-sm"
        data-testid="analytics-disclaimer"
      >
        <strong>Demo-session data.</strong> These numbers come only from visits to this demo store,
        including test and demo traffic, and every order is simulated. They do not describe a real
        store or predict real results.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading analytics…</p>}>
        <Report />
      </Suspense>
    </>
  );
}

async function Report() {
  await requireMerchant();
  const report = analyticsService().report();
  const { funnel } = report;

  return (
    <>
      {report.eventCount === 0 ? (
        <div className="mt-8 rounded-sm border border-dashed border-line p-10 text-center">
          <p className="font-serif text-xl">No events recorded yet.</p>
          <p className="mt-2 text-sm text-muted">
            The funnel fills in as people browse the store and place simulated orders.
          </p>
          <Link href="/collections/all" className="mt-4 inline-block underline underline-offset-2">
            Open the storefront
          </Link>
        </div>
      ) : (
        <>
          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
            <div>
              <dt className="text-muted">Sessions</dt>
              <dd className="text-xl" data-testid="analytics-sessions">
                {funnel.totalSessions}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Events</dt>
              <dd className="text-xl" data-testid="analytics-events">
                {report.eventCount}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Simulated order value</dt>
              <dd className="text-xl" data-testid="analytics-order-value">
                {report.simulatedOrderValue.map((value) => formatMoney(value)).join(", ") || "None"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 overflow-x-auto rounded-sm border border-line bg-white">
            <table className="w-full min-w-[36rem] text-left text-sm" data-testid="funnel-table">
              <caption className="sr-only">Sessions reaching each step of the funnel</caption>
              <thead className="border-b border-line bg-paper text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Step
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Sessions
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Of previous step
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Of first step
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Lost from previous step
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {funnel.rows.map((row) => (
                  <tr key={row.step} data-testid="funnel-row" data-step={row.step}>
                    <th scope="row" className="px-4 py-3 font-medium">
                      {row.label}
                    </th>
                    <td className="px-4 py-3 text-right" data-testid="funnel-sessions">
                      {row.sessions}
                    </td>
                    <td className="px-4 py-3 text-right">{share(row.ofPrevious)}</td>
                    <td className="px-4 py-3 text-right">{share(row.ofFirst)}</td>
                    <td className="px-4 py-3 text-right">{row.dropOff ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.firstEventAt && report.lastEventAt && (
            <p className="mt-2 text-xs text-muted">
              Recorded {timeFormat.format(new Date(report.firstEventAt))} to{" "}
              {timeFormat.format(new Date(report.lastEventAt))} UTC
              {report.truncated ? ", using the most recent events only" : ""}.
            </p>
          )}
        </>
      )}

      <section aria-labelledby="limits-heading" className="mt-8 max-w-3xl text-sm">
        <h2 id="limits-heading" className="font-medium">
          How to read this
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>A session counts at a step only if it reached every earlier step first, in order.</li>
          <li>
            A session is one browser until it closes, so one person can appear more than once.
          </li>
          <li>
            Events store an anonymous random id, the product, quantity and value. They never store a
            name, email, address, cart or order.
          </li>
          <li>Browsers that send Global Privacy Control are not recorded.</li>
          <li>Nothing is sent to Google Analytics, Meta or any other service.</li>
        </ul>
      </section>
    </>
  );
}
