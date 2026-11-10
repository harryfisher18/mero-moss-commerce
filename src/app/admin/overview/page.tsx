import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ORDER_STATUSES } from "@/domain/commerce/order";
import { STATUS_LABELS } from "@/domain/commerce/order-status";
import type { StockAlert } from "@/domain/merchant/overview";
import { requireMerchant } from "@/server/merchant-session";
import { merchantOverview } from "@/server/overview";

export const metadata: Metadata = { title: "Overview" };

const MAX_ALERTS = 8;

export default function OverviewPage() {
  return (
    <>
      <h1 className="font-serif text-3xl">Overview</h1>
      <p
        role="note"
        className="mt-4 max-w-3xl rounded-sm border border-clay bg-clay/5 p-3 text-sm"
        data-testid="overview-disclaimer"
      >
        <strong>Demo data, counted just now.</strong> Every figure is a count of records in this
        demo store. There are no targets, trends or forecasts, and orders are simulated.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Counting…</p>}>
        <OverviewContent />
      </Suspense>
    </>
  );
}

function Figure({
  label,
  value,
  href,
  testId,
}: {
  label: string;
  value: number;
  href: string;
  testId: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded-sm border border-line bg-white p-4 hover:border-ink"
        data-testid={testId}
      >
        <span className="block text-2xl font-medium" data-testid="figure-value">
          {value}
        </span>
        <span className="text-sm text-muted">{label}</span>
      </Link>
    </li>
  );
}

function AlertList({
  title,
  alerts,
  testId,
}: {
  title: string;
  alerts: readonly StockAlert[];
  testId: string;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-sm border border-line bg-white p-4 text-sm"
      data-testid={testId}
    >
      <h3 className="font-medium">
        {title} ({alerts.length})
      </h3>
      {alerts.length === 0 ? (
        <p className="mt-2 text-muted">None.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {alerts.slice(0, MAX_ALERTS).map((alert) => (
            <li key={alert.sku}>
              <Link
                href={`/admin/products/${alert.productId}`}
                className="underline underline-offset-2"
              >
                {alert.productTitle}
              </Link>
              {alert.variantTitle ? ` · ${alert.variantTitle}` : ""}
              <span className="text-muted"> · {alert.inventory} left</span>
            </li>
          ))}
          {alerts.length > MAX_ALERTS && (
            <li className="text-muted">and {alerts.length - MAX_ALERTS} more in Products.</li>
          )}
        </ul>
      )}
    </section>
  );
}

async function OverviewContent() {
  await requireMerchant();
  const { counts, alerts, attention, activeProducts } = merchantOverview();

  return (
    <div className="mt-6 space-y-8">
      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="font-medium">
          Needs attention
        </h2>
        {attention.length === 0 ? (
          <p className="mt-2 text-sm text-muted" data-testid="attention-empty">
            Nothing needs attention right now.
          </p>
        ) : (
          <ul className="mt-2 space-y-2" data-testid="attention">
            {attention.map((item) => (
              <li key={item.key} data-key={item.key}>
                <Link href={item.href} className="text-sm underline underline-offset-2">
                  <strong>{item.count}</strong> {item.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="orders-heading">
        <h2 id="orders-heading" className="font-medium">
          Orders
        </h2>
        <ul className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Figure
            label="Held for review"
            value={counts.heldForReview}
            href="/admin/orders?view=review"
            testId="figure-review"
          />
          {ORDER_STATUSES.map((status) => (
            <Figure
              key={status}
              label={STATUS_LABELS[status]}
              value={counts.ordersByStatus[status]}
              href={`/admin/orders?status=${status}`}
              testId={`figure-${status}`}
            />
          ))}
        </ul>
      </section>

      <section aria-labelledby="stock-heading">
        <h2 id="stock-heading" className="font-medium">
          Stock{" "}
          <span className="font-normal text-muted">({activeProducts} products in the shop)</span>
        </h2>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <AlertList title="Sold out" alerts={alerts.soldOut} testId="alerts-sold-out" />
          <AlertList title="Low stock" alerts={alerts.lowStock} testId="alerts-low-stock" />
        </div>
      </section>

      <section aria-labelledby="operations-heading">
        <h2 id="operations-heading" className="font-medium">
          Operations
        </h2>
        <ul className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
          <Figure
            label="Automation jobs waiting to retry"
            value={counts.automation.retrying}
            href="/admin/automations?status=retrying"
            testId="figure-retrying"
          />
          <Figure
            label="Automation jobs in the dead letter queue"
            value={counts.automation.dead}
            href="/admin/automations?status=dead"
            testId="figure-dead"
          />
          <Figure
            label="Customer requests received"
            value={counts.supportRequests}
            href="/admin/support"
            testId="figure-requests"
          />
        </ul>
      </section>
    </div>
  );
}
