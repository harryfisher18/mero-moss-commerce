import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventStatusBadge } from "@/components/admin/event-status-badge";
import { OrderStatusActions } from "@/components/admin/order-status-actions";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { formatMoney } from "@/domain/commerce/money";
import { SHIPPING_REGIONS } from "@/domain/commerce/order";
import { allowedTransitions, STATUS_LABELS } from "@/domain/commerce/order-status";
import { tagLabel } from "@/domain/events/order-created";
import { EVENT_TYPE_LABELS } from "@/domain/events/outbox";
import { automationService } from "@/server/automation";
import { merchantOrders, requireMerchant } from "@/server/merchant-session";

export const metadata: Metadata = { title: "Order detail" };

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default function OrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <>
      <Link href="/admin/orders" className="text-sm text-muted hover:text-ink hover:underline">
        ← All orders
      </Link>
      <Suspense fallback={<p className="mt-8 text-muted">Loading order…</p>}>
        <OrderDetail params={params} />
      </Suspense>
    </>
  );
}

async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireMerchant();
  const { id } = await params;
  const result = merchantOrders().get(id);
  if (!result) notFound();
  const { order, events } = result;
  const automation = automationService().forOrder(order.id);
  const address = order.shippingAddress;

  return (
    <article className="mt-4" data-testid="admin-order-detail">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl">{order.orderNumber}</h1>
        <OrderStatusBadge status={order.status} />
        <span className="rounded-full border border-clay px-2 py-0.5 text-xs text-clay uppercase">
          Simulated · no payment
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Placed {dateFormat.format(new Date(order.createdAt))} UTC
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="lines-heading" className="rounded-sm border border-line bg-white">
          <h2 id="lines-heading" className="border-b border-line px-4 py-3 font-medium">
            Items
          </h2>
          <table className="w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Quantity</th>
                <th scope="col">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {order.lines.map((line) => (
                <tr key={line.variantId}>
                  <td className="px-4 py-3">
                    {line.productTitle}
                    {line.variantTitle && (
                      <span className="text-muted"> · {line.variantTitle}</span>
                    )}
                    <span className="block text-xs text-muted">
                      SKU {line.sku} · {formatMoney(line.unitPrice)} each
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">× {line.quantity}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="space-y-1 border-t border-line px-4 py-3 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatMoney(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd>{order.shipping.amountMinor === 0 ? "Free" : formatMoney(order.shipping)}</dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt>Total</dt>
              <dd data-testid="admin-order-total">{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6">
          <section
            aria-labelledby="actions-heading"
            className="rounded-sm border border-line bg-white p-4"
          >
            <h2 id="actions-heading" className="font-medium">
              Update status
            </h2>
            <OrderStatusActions
              key={order.status}
              orderId={order.id}
              targets={[...allowedTransitions(order.status)]}
            />
          </section>

          <section
            aria-labelledby="automation-heading"
            className="rounded-sm border border-line bg-white p-4 text-sm"
            data-testid="order-automation"
          >
            <h2 id="automation-heading" className="font-medium">
              Automation
            </h2>
            {automation.tags.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {automation.tags.map((tag) => (
                  <li
                    key={tag.tag}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      tag.tag.startsWith("review:")
                        ? "bg-clay/15 text-clay"
                        : "bg-moss/15 text-moss"
                    }`}
                  >
                    {tagLabel(tag.tag)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-muted">Not routed yet.</p>
            )}
            <ul className="mt-3 space-y-1">
              {automation.events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/automations/${event.id}`}
                    className="underline underline-offset-2"
                  >
                    {EVENT_TYPE_LABELS[event.type]} event
                  </Link>
                  <EventStatusBadge status={event.status} attempts={event.attempts} />
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="customer-heading"
            className="rounded-sm border border-line bg-white p-4 text-sm"
          >
            <h2 id="customer-heading" className="font-medium">
              Customer
            </h2>
            <p className="mt-2">{order.email}</p>
            <address className="mt-2 leading-relaxed not-italic">
              {address.fullName}
              <br />
              {address.address1}
              {address.address2 && (
                <>
                  <br />
                  {address.address2}
                </>
              )}
              <br />
              {address.city}, {SHIPPING_REGIONS[address.region]} {address.postalCode}
            </address>
          </section>

          <section
            aria-labelledby="history-heading"
            className="rounded-sm border border-line bg-white p-4 text-sm"
          >
            <h2 id="history-heading" className="font-medium">
              History
            </h2>
            <ol className="mt-2 space-y-2" data-testid="order-history">
              {events.map((event, index) => (
                <li key={index}>
                  <span className="font-medium">{STATUS_LABELS[event.toStatus]}</span>
                  <span className="block text-xs text-muted">
                    {dateFormat.format(new Date(event.createdAt))} UTC · {event.actor}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </article>
  );
}
