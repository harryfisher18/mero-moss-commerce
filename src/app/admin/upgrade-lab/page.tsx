import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UpgradeLabProduct } from "@/components/admin/upgrade-lab-product";
import { UpgradeLabTriage } from "@/components/admin/upgrade-lab-triage";
import { formatMoney } from "@/domain/commerce/money";
import { NOTIFICATION_KIND_LABELS, redactRecipient, tagLabel } from "@/domain/events/order-created";
import {
  expectedTriage,
  type LabTab,
  LAB_TABS,
  legacyOrderNote,
  parseLabParams,
} from "@/domain/upgrade-lab/comparisons";
import { requireMerchant } from "@/server/merchant-session";
import { discoveryComparison, orderComparison, productComparison } from "@/server/upgrade-lab";

export const metadata: Metadata = { title: "Upgrade Lab" };

const TAB_LABELS: Record<LabTab, string> = {
  product: "Mobile product page",
  discovery: "Product discovery",
  orders: "Order operations",
};

const EXAMPLE_QUESTIONS = ["storage", "Travel gifts under $50", "Linen storage bin in Moss"];

const chipClass = (current: boolean) =>
  `inline-block rounded-full border px-3 py-1 ${
    current ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
  }`;

export default function UpgradeLabPage({ searchParams }: PageProps<"/admin/upgrade-lab">) {
  return (
    <>
      <h1 className="font-serif text-3xl">Upgrade Lab</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Same catalog, same orders, two experiences. Use both sides to see what each upgrade changes.
      </p>
      <p
        role="note"
        className="mt-4 max-w-3xl rounded-sm border border-clay bg-clay/5 p-3 text-sm"
        data-testid="lab-disclaimer"
      >
        <strong>Illustrative, not measured.</strong> Each &ldquo;before&rdquo; was built for this
        demo. It is not a previous client site or a past version of this store, and no conversion,
        revenue or speed result is claimed.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading the Upgrade Lab…</p>}>
        <Lab searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Lab({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireMerchant();
  const params = parseLabParams(await searchParams);

  return (
    <>
      <nav aria-label="Comparisons" className="mt-6">
        <ul className="flex flex-wrap gap-2 text-sm">
          {LAB_TABS.map((tab) => (
            <li key={tab}>
              <Link
                href={`/admin/upgrade-lab?lab=${tab}`}
                aria-current={tab === params.lab ? "page" : undefined}
                className={chipClass(tab === params.lab)}
              >
                {TAB_LABELS[tab]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6">
        {params.lab === "product" && <ProductTab handle={params.product} />}
        {params.lab === "discovery" && <DiscoveryTab question={params.question} />}
        {params.lab === "orders" && <OrdersTab orderId={params.order} />}
      </div>
    </>
  );
}

function ProductTab({ handle }: { handle: string | undefined }) {
  const { choices, product, policies } = productComparison(handle);
  if (!product) {
    return <p className="text-muted">No active product has more than one variant to compare.</p>;
  }
  return (
    <section aria-labelledby="lab-product-heading">
      <h2 id="lab-product-heading" className="font-serif text-2xl">
        {TAB_LABELS.product}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Pick a sold-out option on each side and press Add. Neither side changes a real cart.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Products to compare">
        {choices.map((choice) => (
          <li key={choice.id}>
            <Link
              href={`/admin/upgrade-lab?lab=product&product=${encodeURIComponent(choice.handle)}`}
              aria-current={choice.id === product.id ? "true" : undefined}
              className={chipClass(choice.id === product.id)}
            >
              {choice.title}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <UpgradeLabProduct key={product.id} product={product} policies={policies} />
      </div>
    </section>
  );
}

async function DiscoveryTab({ question }: { question: string }) {
  const comparison = question ? await discoveryComparison(question) : null;
  return (
    <section aria-labelledby="lab-discovery-heading">
      <h2 id="lab-discovery-heading" className="font-serif text-2xl">
        {TAB_LABELS.discovery}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        One question, two approaches, the same live catalog. The right side uses the store&rsquo;s
        catalog rules only, so no AI service is called here.
      </p>
      <form action="/admin/upgrade-lab" method="get" className="mt-3" data-testid="lab-search">
        <input type="hidden" name="lab" value="discovery" />
        <label htmlFor="lab-question" className="block text-sm font-medium">
          Shopper question
        </label>
        <div className="mt-1 flex max-w-xl flex-col gap-2 sm:flex-row">
          <input
            id="lab-question"
            name="q"
            type="search"
            defaultValue={question}
            maxLength={300}
            className="w-full rounded-sm border border-line bg-white px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper hover:bg-moss"
          >
            Compare
          </button>
        </div>
      </form>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Example questions">
        {EXAMPLE_QUESTIONS.map((example) => (
          <li key={example}>
            <Link
              href={`/admin/upgrade-lab?lab=discovery&q=${encodeURIComponent(example)}`}
              className={chipClass(example === question)}
            >
              {example}
            </Link>
          </li>
        ))}
      </ul>

      {comparison && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section aria-label="Before (illustrative)" data-testid="lab-before">
            <h3 className="text-sm font-medium">Before (illustrative): title keyword search</h3>
            {comparison.before.length === 0 ? (
              <p className="mt-2 rounded-sm border border-line bg-white p-4 text-sm">
                0 results found.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-line rounded-sm border border-line bg-white text-sm">
                {comparison.before.map((result) => (
                  <li key={result.handle} className="p-3" data-testid="lab-keyword-result">
                    <Link href={`/products/${result.handle}`} className="underline">
                      {result.title}
                    </Link>
                    <span className="block text-xs text-muted">{result.priceLabel}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="After (this store's rules)" data-testid="lab-after">
            <h3 className="text-sm font-medium">After (this store&rsquo;s rules): the advisor</h3>
            <div className="mt-2 rounded-sm border border-line bg-white p-4 text-sm">
              <p className="font-medium" data-testid="lab-advisor-lead">
                {comparison.after.answer.lead}
              </p>
              {comparison.after.answer.notes.map((note) => (
                <p key={note} className="mt-2 text-clay">
                  {note}
                </p>
              ))}
              <ul className="mt-2 divide-y divide-line">
                {comparison.after.answer.cards.map((card) => (
                  <li key={card.variantId} className="py-2" data-testid="lab-advisor-card">
                    <Link href={card.url} className="underline">
                      {card.productTitle}
                    </Link>
                    {card.variantTitle && (
                      <span className="text-muted"> · {card.variantTitle}</span>
                    )}
                    <span className="block text-xs text-muted">
                      {formatMoney(card.price)} · {card.stock}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function OrdersTab({ orderId }: { orderId: string | undefined }) {
  const data = orderComparison(orderId);
  if (!data)
    return <p className="text-muted">The catalog has nothing in stock to build an order.</p>;
  return (
    <section aria-labelledby="lab-orders-heading">
      <h2 id="lab-orders-heading" className="font-serif text-2xl">
        {TAB_LABELS.orders}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        The same order as a forwarded note and through the automation rules. Nothing here changes
        the order or sends a message.
      </p>
      {data.isSample ? (
        <p className="mt-3 text-sm" data-testid="lab-sample-order">
          No orders yet, so this uses a sample order built from the catalog. It is not saved.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Orders to compare">
          {data.recent.map((order) => (
            <li key={order.id}>
              <Link
                href={`/admin/upgrade-lab?lab=orders&order=${encodeURIComponent(order.id)}`}
                aria-current={order.id === data.selectedId ? "true" : undefined}
                className={chipClass(order.id === data.selectedId)}
              >
                {order.orderNumber}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <section aria-label="Before (illustrative)" data-testid="lab-before">
          <h3 className="text-sm font-medium">Before (illustrative): a manual hand-off</h3>
          <div className="mt-2 rounded-sm border border-line bg-white p-4">
            <pre className="font-sans text-sm whitespace-pre-wrap" data-testid="lab-order-note">
              {legacyOrderNote(data.payload)}
            </pre>
            <p className="mt-3 text-xs text-muted">Decide by hand, using only this note:</p>
            <UpgradeLabTriage key={data.payload.orderId} expected={expectedTriage(data.payload)} />
          </div>
        </section>

        <section aria-label="After (this store's rules)" data-testid="lab-after">
          <h3 className="text-sm font-medium">After (this store&rsquo;s rules): event-driven</h3>
          <div className="mt-2 space-y-3 rounded-sm border border-line bg-white p-4 text-sm">
            <ul className="flex flex-wrap gap-2" data-testid="lab-order-tags">
              {data.routing.tags.map((tag) => (
                <li
                  key={tag}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    tag.startsWith("review:") ? "bg-clay/15 text-clay" : "bg-moss/15 text-moss"
                  }`}
                >
                  {tagLabel(tag)}
                </li>
              ))}
            </ul>
            <p data-testid="lab-order-review">
              {data.routing.needsReview
                ? data.routing.reviewReasons.join(" ")
                : "No review needed under the current rules."}
            </p>
            <ul className="space-y-2">
              {data.previews.map((preview) => (
                <li key={preview.kind} className="rounded-sm bg-paper p-3">
                  <p className="font-medium">{NOTIFICATION_KIND_LABELS[preview.kind]}</p>
                  <p className="text-xs text-muted">
                    To {redactRecipient(preview.recipient)} · Preview only, not sent
                  </p>
                  <p className="mt-1 text-xs">{preview.subject}</p>
                </li>
              ))}
            </ul>
            {data.eventId && (
              <Link
                href={`/admin/automations/${data.eventId}`}
                className="inline-block underline underline-offset-2"
              >
                Open this order&rsquo;s real job log
              </Link>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
