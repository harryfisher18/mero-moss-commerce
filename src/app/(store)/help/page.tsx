import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buildFaq } from "@/domain/commerce/faq";
import { getStorePolicies } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description: "Answers about orders, shipping, returns, warranty and privacy at Mero & Moss.",
};

export default function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-10 pb-12 sm:px-6">
      <h1 className="font-serif text-4xl">Help &amp; FAQ</h1>
      <p className="mt-3 text-muted">
        Answers to the questions we hear most. Shipping, returns and warranty answers are our
        published store policies, word for word.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading answers…</p>}>
        <Answers />
      </Suspense>
    </div>
  );
}

async function Answers() {
  const faq = buildFaq(await getStorePolicies());
  return (
    <div className="mt-8 space-y-4" data-testid="faq">
      {faq.map((entry) => (
        <details
          key={entry.id}
          id={`faq-${entry.id}`}
          className="scroll-mt-6 rounded-sm border border-line bg-white/40 p-5"
          data-testid="faq-entry"
        >
          <summary className="cursor-pointer font-serif text-lg">{entry.question}</summary>
          <p className="mt-4 text-sm leading-relaxed">{entry.answer}</p>
          {entry.policyKey && (
            <p className="mt-2 text-xs text-muted">From our published store policy.</p>
          )}
          {entry.link && (
            <p className="mt-3 text-sm">
              <Link href={entry.link.href} className="underline underline-offset-2">
                {entry.link.label}
              </Link>
            </p>
          )}
        </details>
      ))}
    </div>
  );
}
