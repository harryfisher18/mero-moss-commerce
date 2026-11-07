import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SupportRequestForm } from "@/components/store/support-request-form";
import { MAX_QUESTION_LENGTH } from "@/domain/advisor/query";
import { formatMoney } from "@/domain/commerce/money";
import { recommendationProvider } from "@/server/advisor";
import type { WordingOutcome } from "@/server/integrations/recommendation-provider";

export const metadata: Metadata = {
  title: "Shopping advisor",
  description:
    "Ask about our products, budgets, colors, sizes, shipping and returns. Answers come from our live catalog.",
  robots: { index: false },
};

const EXAMPLES = [
  "Travel gifts under $50",
  "Linen storage bin in Oat",
  "Compare the felt desk mat and the oak monitor stand",
  "Is anything on sale?",
  "What is your return policy?",
];

const SOURCE_TEXT: Record<WordingOutcome, string> = {
  not_configured: "Built directly from our live catalog and published policies.",
  not_needed: "Built directly from our live catalog and published policies.",
  used: "Worded by our assistant from the live catalog facts below. Prices and stock are exactly as listed.",
  fallback:
    "Assisted wording is not available right now, so this answer comes straight from our live catalog.",
};

export default function AdvisorPage({ searchParams }: PageProps<"/advisor">) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-10 pb-16 sm:px-6">
      <h1 className="font-serif text-4xl">Shopping advisor</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Ask about products, budgets, colors and sizes, or our shipping and returns. Answers come
        from our live catalog and published policies, so prices and stock are always current.
      </p>
      {/* Rendered once, outside Suspense, so typing is never lost when content streams in. */}
      <AskForm />
      <Suspense fallback={null}>
        <AdvisorBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function AskForm() {
  return (
    <form action="/advisor" method="get" role="search" className="mt-8" data-testid="advisor-form">
      <label htmlFor="advisor-question" className="block text-sm font-medium">
        Your question
      </label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <input
          id="advisor-question"
          name="q"
          type="search"
          maxLength={MAX_QUESTION_LENGTH}
          placeholder="For example: a gift for the kitchen under $40"
          className="w-full rounded-sm border border-line bg-white px-3 py-2.5"
        />
        <button
          type="submit"
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-paper hover:bg-moss"
        >
          Ask
        </button>
      </div>
    </form>
  );
}

async function AdvisorBody({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { q } = await searchParams;
  const question = typeof q === "string" ? q.trim().slice(0, MAX_QUESTION_LENGTH) : "";

  return (
    <>
      {question ? (
        <Suspense
          key={question}
          fallback={<p className="mt-10 text-muted">Looking through the catalog…</p>}
        >
          <Answer question={question} />
        </Suspense>
      ) : (
        <section aria-labelledby="examples-heading" className="mt-8">
          <h2 id="examples-heading" className="text-sm font-medium text-muted">
            Try asking
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <Link
                  href={`/advisor?q=${encodeURIComponent(example)}`}
                  className="inline-block rounded-full border border-line px-3 py-1.5 hover:border-ink"
                >
                  {example}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        id="talk-to-a-person"
        aria-labelledby="person-heading"
        className="mt-16 rounded-sm border border-line bg-white p-6"
      >
        <h2 id="person-heading" className="font-serif text-2xl">
          Talk to a person
        </h2>
        <p className="mt-2 text-sm text-muted">
          Leave your email and question, and our team will reply by email. This is a demo store:
          requests are saved for the shop team and no email is sent.
        </p>
        <div className="mt-5">
          <SupportRequestForm question={question} />
        </div>
      </section>
    </>
  );
}

async function Answer({ question }: { question: string }) {
  await connection();
  const { answer, wording, wordingOutcome } = await recommendationProvider().answer(question);

  return (
    <section aria-labelledby="answer-heading" className="mt-10" data-testid="advisor-answer">
      <h2 id="answer-heading" className="text-sm text-muted" data-testid="advisor-question">
        You asked: &ldquo;{question}&rdquo;
      </h2>
      <p className="mt-2 font-serif text-2xl leading-snug" data-testid="advisor-lead">
        {wording ?? answer.lead}
      </p>
      <p className="mt-2 text-xs text-muted" data-testid="advisor-source">
        {SOURCE_TEXT[wordingOutcome]}
      </p>

      {answer.notes.length > 0 && (
        <ul className="mt-5 space-y-2 text-sm" data-testid="advisor-notes">
          {answer.notes.map((note) => (
            <li key={note} className="rounded-sm border-l-2 border-clay bg-clay/5 px-3 py-2">
              {note}
            </li>
          ))}
        </ul>
      )}

      {answer.cards.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {answer.cards.map((card) => (
            <li
              key={card.variantId}
              className="flex flex-col rounded-sm border border-line bg-white p-5"
              data-testid="advisor-card"
              data-variant-id={card.variantId}
            >
              <h3 className="font-serif text-xl">
                <Link href={card.url} className="hover:underline">
                  {card.productTitle}
                </Link>
              </h3>
              {card.variantTitle && <p className="text-sm text-muted">{card.variantTitle}</p>}
              <p className="mt-2" data-testid="advisor-card-price">
                <span className="font-medium">{formatMoney(card.price)}</span>
                {card.compareAtPrice && (
                  <>
                    {" "}
                    <s className="text-muted">{formatMoney(card.compareAtPrice)}</s>{" "}
                    <span className="text-xs font-medium text-clay uppercase">Sale</span>
                  </>
                )}
              </p>
              <p className="text-sm text-moss" data-testid="advisor-card-stock">
                {card.stock}
              </p>
              <p className="mt-3 text-sm leading-relaxed">{card.summary}</p>
              <p className="mt-2 text-xs text-muted">Materials: {card.materials}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5 text-xs" aria-label="Why it matches">
                {card.reasons.map((reason) => (
                  <li key={reason} className="rounded-full bg-paper px-2 py-0.5 text-muted">
                    {reason}
                  </li>
                ))}
              </ul>
              <Link
                href={card.url}
                className="mt-4 self-start text-sm font-medium underline underline-offset-2"
              >
                View details<span className="sr-only"> for {card.productTitle}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {answer.policies.map((policy) => (
        <figure
          key={policy.key}
          className="mt-6 rounded-sm border border-line bg-white p-5"
          data-testid="advisor-policy"
          data-key={policy.key}
        >
          <figcaption className="text-sm font-medium">{policy.title} policy</figcaption>
          <blockquote className="mt-2 text-sm leading-relaxed">{policy.body}</blockquote>
        </figure>
      ))}

      {answer.suggestEscalation && (
        <p className="mt-6 text-sm">
          Want a person to help?{" "}
          <a href="#talk-to-a-person" className="underline underline-offset-2">
            Ask our team
          </a>
          .
        </p>
      )}
    </section>
  );
}
