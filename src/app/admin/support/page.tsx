import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { advisorStatus, supportService } from "@/server/advisor";
import type { IntegrationState } from "@/server/integrations/wording-provider";
import { requireMerchant } from "@/server/merchant-session";

export const metadata: Metadata = { title: "Customer requests" };

const timeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const STATE_LABELS: Record<IntegrationState, string> = {
  DEMO: "Demo · catalog answers only",
  CONFIGURED: "Configured · not yet verified",
  CONNECTED_VERIFIED: "Connected · verified",
  ERROR: "Error",
};

const STATE_STYLES: Record<IntegrationState, string> = {
  DEMO: "bg-line text-ink",
  CONFIGURED: "bg-[#e6edf5] text-[#2c4a6b]",
  CONNECTED_VERIFIED: "bg-moss/15 text-moss",
  ERROR: "bg-clay text-paper",
};

export default function SupportPage() {
  return (
    <>
      <h1 className="font-serif text-3xl">Customer requests</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Questions shoppers sent to the team from the shopping advisor&rsquo;s &ldquo;Talk to a
        person&rdquo; form. In this demo, nothing is emailed: reply from your own mailbox.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading requests…</p>}>
        <Requests />
      </Suspense>
    </>
  );
}

async function Requests() {
  await requireMerchant();
  const status = advisorStatus().snapshot();
  const requests = supportService().list();

  return (
    <>
      <section
        aria-labelledby="advisor-status-heading"
        className="mt-6 rounded-sm border border-line bg-white p-4 text-sm"
        data-testid="advisor-status"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="advisor-status-heading" className="font-medium">
            Shopping advisor
          </h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_STYLES[status.state]}`}
            data-testid="advisor-state"
          >
            {STATE_LABELS[status.state]}
          </span>
        </div>
        <p className="mt-2 text-muted">
          {status.state === "DEMO"
            ? "Answers are built from the live catalog and published policies with deterministic rules. Set ANTHROPIC_API_KEY to add assisted wording; facts are still validated against the catalog."
            : status.state === "CONFIGURED"
              ? `A key is set for ${status.model ?? "the model"}, but no request has been verified in this server process yet.`
              : status.state === "CONNECTED_VERIFIED"
                ? `${status.model ?? "The model"} answered at ${status.lastEventAt ? timeFormat.format(new Date(status.lastEventAt)) : "an unknown time"} UTC. Replies rejected by validation: ${String(status.rejectedReplies)}.`
                : `Assisted wording failed: ${status.lastIssue ?? "unknown error"}. Shoppers get catalog answers meanwhile.`}
        </p>
        {status.state === "CONNECTED_VERIFIED" && status.lastIssue && (
          <p className="mt-1 text-xs text-muted">Last issue: {status.lastIssue}</p>
        )}
        <Link href="/advisor" className="mt-2 inline-block underline underline-offset-2">
          Open the advisor
        </Link>
      </section>

      {requests.length === 0 ? (
        <div className="mt-8 rounded-sm border border-dashed border-line p-10 text-center">
          <p className="font-serif text-xl">No requests yet.</p>
          <p className="mt-2 text-sm text-muted">
            Requests appear here when a shopper uses &ldquo;Talk to a person&rdquo; in the advisor.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4" data-testid="support-requests">
          {requests.map((request) => (
            <li
              key={request.id}
              className="rounded-sm border border-line bg-white p-4 text-sm"
              data-testid="support-request"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <a href={`mailto:${request.email}`} className="font-medium underline">
                  {request.email}
                </a>
                <span className="text-xs text-muted">
                  {timeFormat.format(new Date(request.createdAt))} UTC
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{request.message}</p>
              {request.question && (
                <p className="mt-2 text-xs text-muted">
                  Asked the advisor: &ldquo;{request.question}&rdquo;
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
