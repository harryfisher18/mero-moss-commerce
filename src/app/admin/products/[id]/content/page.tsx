import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  DraftDecision,
  DraftEditForm,
  GenerateDraftButton,
} from "@/components/admin/content-studio-controls";
import { checkContent } from "@/domain/content/constraints";
import { diffWords } from "@/domain/content/diff";
import {
  CONTENT_FIELD_LABELS,
  CONTENT_FIELDS,
  currentContent,
  productFacts,
} from "@/domain/content/draft";
import { contentAiStatus, contentStudio } from "@/server/content-studio";
import type { ContentDraft, ContentDraftSource } from "@/server/content-studio-service";
import { requireMerchant } from "@/server/merchant-session";

export const metadata: Metadata = { title: "Content Studio" };

const timeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const formatTime = (iso: string) => `${timeFormat.format(new Date(iso))} UTC`;

const SOURCE_LABELS: Record<ContentDraftSource, string> = {
  rules: "Rules-based draft",
  ai: "AI draft",
  edited: "Edited by merchant",
};

const STATUS_STYLES: Record<ContentDraft["status"], string> = {
  pending: "bg-[#e6edf5] text-[#2c4a6b]",
  approved: "bg-moss/15 text-moss",
  rejected: "bg-clay/15 text-clay",
  superseded: "bg-line text-ink",
};

export default function ContentStudioPage({ params }: PageProps<"/admin/products/[id]/content">) {
  return (
    <Suspense fallback={<p className="mt-8 text-muted">Loading Content Studio…</p>}>
      <ContentStudio params={params} />
    </Suspense>
  );
}

async function ContentStudio({ params }: { params: Promise<{ id: string }> }) {
  await requireMerchant();
  const { id } = await params;
  const studio = contentStudio();
  const product = studio.product(id);
  if (!product) notFound();
  const facts = productFacts(product);
  const live = currentContent(product);
  const drafts = studio.drafts(product.id);
  const latest = drafts[0];
  const violations = latest ? checkContent(latest.fields, facts) : [];
  const stale = latest ? latest.baseUpdatedAt !== product.updatedAt : false;
  const ai = contentAiStatus().snapshot();

  return (
    <>
      <Link
        href={`/admin/products/${product.id}`}
        className="text-sm text-muted hover:text-ink hover:underline"
      >
        ← Back to {product.title}
      </Link>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-serif text-3xl">Content Studio</h1>
        <p className="text-muted">{product.title}</p>
      </div>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Propose a title, summary and search description from the product facts. Drafts change
        nothing until you approve them, and approval publishes to the demo catalog only, with every
        change recorded in the product&rsquo;s change history.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <section
            aria-labelledby="mode-heading"
            className="rounded-sm border border-line bg-white p-4 text-sm"
            data-testid="drafting-mode"
          >
            <h2 id="mode-heading" className="font-medium">
              Drafting mode
            </h2>
            <p className="mt-1">
              {ai.state === "DEMO"
                ? "Rules-based drafts: no AI key is configured, so drafts are assembled only from the product facts. Set ANTHROPIC_API_KEY to add AI drafts."
                : ai.state === "ERROR"
                  ? `AI drafting (${ai.model ?? "model"}) failed last time: ${ai.lastIssue ?? "unknown error"}. Rules-based drafts are used meanwhile.`
                  : `AI drafts with ${ai.model ?? "the configured model"}${ai.state === "CONFIGURED" ? " (configured, not yet verified)" : " (verified)"}. Every draft is checked against the product facts.`}
            </p>
            <div className="mt-3">
              <GenerateDraftButton productId={product.id} />
            </div>
          </section>

          {!latest ? (
            <div className="rounded-sm border border-dashed border-line p-8 text-center">
              <p className="font-serif text-xl">No drafts yet.</p>
              <p className="mt-2 text-sm text-muted">Generate a draft to review it here.</p>
            </div>
          ) : (
            <section
              aria-labelledby="draft-heading"
              className="rounded-sm border border-line bg-white p-5"
              data-testid="latest-draft"
              data-status={latest.status}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="draft-heading" className="font-serif text-2xl">
                  Draft v{latest.version}
                </h2>
                <span
                  className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-medium"
                  data-testid="draft-source"
                >
                  {SOURCE_LABELS[latest.source]}
                  {latest.model ? ` · ${latest.model}` : ""}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[latest.status]}`}
                  data-testid="draft-status"
                >
                  {latest.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {latest.sourceNote} Created by {latest.createdBy}, {formatTime(latest.createdAt)}.
              </p>

              {latest.status === "approved" && (
                <p
                  role="note"
                  className="mt-4 rounded-sm bg-moss/10 p-3 text-sm text-moss"
                  data-testid="approved-notice"
                >
                  Approved by {latest.decidedBy} and published to the demo catalog
                  {latest.decidedAt ? ` on ${formatTime(latest.decidedAt)}` : ""}.
                </p>
              )}
              {latest.status === "rejected" && (
                <p role="note" className="mt-4 rounded-sm bg-clay/10 p-3 text-sm text-clay">
                  Rejected by {latest.decidedBy}. The live copy is unchanged.
                </p>
              )}

              {latest.status === "pending" && (
                <div className="mt-4" data-testid="constraint-checks">
                  {violations.length === 0 ? (
                    <p className="rounded-sm bg-moss/10 p-3 text-sm text-moss">
                      All factual checks pass: no prices, numbers, materials or claims beyond the
                      product facts, and every field is within its length limit.
                    </p>
                  ) : (
                    <div className="rounded-sm border border-clay bg-clay/5 p-3 text-sm">
                      <p className="font-medium text-clay">
                        {violations.length} {violations.length === 1 ? "issue" : "issues"} to fix
                        before this draft can be approved:
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-5" data-testid="violations">
                        {violations.map((violation, index) => (
                          <li key={index} data-rule={violation.rule}>
                            {violation.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {stale && (
                    <p role="note" className="mt-3 rounded-sm bg-clay/10 p-3 text-sm text-clay">
                      The product changed after this draft was created, so it cannot be approved.
                      Generate a new draft from the current product.
                    </p>
                  )}
                </div>
              )}

              <h3 className="mt-6 text-sm font-medium">Changes against the live copy</h3>
              <dl className="mt-2 space-y-4 text-sm" data-testid="draft-diff">
                {CONTENT_FIELDS.map((field) => {
                  const segments = diffWords(live[field], latest.fields[field]);
                  const changed = segments.some((s) => s.type !== "same");
                  return (
                    <div key={field} data-field={field}>
                      <dt className="text-xs text-muted">
                        {CONTENT_FIELD_LABELS[field]}
                        {changed ? "" : " (unchanged)"}
                      </dt>
                      <dd className="mt-1 leading-relaxed">
                        {segments.length === 0 ? (
                          <span className="text-muted">Empty</span>
                        ) : (
                          segments.map((segment, index) =>
                            segment.type === "added" ? (
                              <ins key={index} className="bg-moss/15 text-moss no-underline">
                                {segment.text}
                              </ins>
                            ) : segment.type === "removed" ? (
                              <del key={index} className="bg-clay/10 text-clay">
                                {segment.text}
                              </del>
                            ) : (
                              <span key={index}>{segment.text}</span>
                            ),
                          )
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>

              {latest.status === "pending" && (
                <>
                  <h3 className="mt-8 text-sm font-medium">Edit this draft</h3>
                  <div className="mt-2">
                    <DraftEditForm key={latest.id} draftId={latest.id} fields={latest.fields} />
                  </div>
                  <h3 className="mt-8 text-sm font-medium">Decision</h3>
                  {violations.length > 0 && !stale && (
                    <p className="mt-1 text-xs text-muted">
                      Approval becomes available once every check passes.
                    </p>
                  )}
                  <div className="mt-2">
                    <DraftDecision
                      key={latest.id}
                      draftId={latest.id}
                      canApprove={violations.length === 0 && !stale}
                    />
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section
            aria-labelledby="facts-heading"
            className="rounded-sm border border-line bg-white p-4 text-sm"
            data-testid="product-facts"
          >
            <h2 id="facts-heading" className="font-medium">
              Product facts
            </h2>
            <p className="mt-1 text-xs text-muted">Drafts may only use what is listed here.</p>
            <dl className="mt-3 space-y-2">
              <div>
                <dt className="text-xs text-muted">Category</dt>
                <dd>{facts.category}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Materials</dt>
                <dd>{facts.materials}</dd>
              </div>
              {facts.options.map((option) => (
                <div key={option.name}>
                  <dt className="text-xs text-muted">{option.name}</dt>
                  <dd>{option.values.join(", ")}</dd>
                </div>
              ))}
              <div>
                <dt className="text-xs text-muted">Description</dt>
                <dd>{facts.description}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Care</dt>
                <dd>{facts.care}</dd>
              </div>
              {facts.tags.length > 0 && (
                <div>
                  <dt className="text-xs text-muted">Tags</dt>
                  <dd>{facts.tags.join(", ")}</dd>
                </div>
              )}
            </dl>
          </section>

          <section
            aria-labelledby="versions-heading"
            className="rounded-sm border border-line bg-white p-4 text-sm"
          >
            <h2 id="versions-heading" className="font-medium">
              Versions
            </h2>
            {drafts.length === 0 ? (
              <p className="mt-2 text-muted">None yet.</p>
            ) : (
              <ol className="mt-2 space-y-2" data-testid="draft-versions">
                {drafts.map((draft) => (
                  <li key={draft.id} data-version={draft.version} data-status={draft.status}>
                    <span className="font-medium">v{draft.version}</span> ·{" "}
                    {SOURCE_LABELS[draft.source]} ·{" "}
                    <span className="capitalize">{draft.status}</span>
                    <span className="block text-xs text-muted">
                      {draft.createdBy}, {formatTime(draft.createdAt)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
