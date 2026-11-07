import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SimulatedOrderNotice } from "@/components/store/simulated-order-notice";
import { formatMoney } from "@/domain/commerce/money";
import { SHIPPING_REGIONS } from "@/domain/commerce/order";
import { getLastOrder } from "@/server/checkout-session";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false },
};

export default function ConfirmationPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-10 pb-12 sm:px-6">
      <Suspense fallback={<p className="text-muted">Loading your order…</p>}>
        <Confirmation />
      </Suspense>
    </div>
  );
}

async function Confirmation() {
  const order = await getLastOrder();

  if (!order) {
    return (
      <div className="py-12 text-center">
        <h1 className="font-serif text-3xl">We couldn’t find a recent order.</h1>
        <p className="mt-3 text-muted">
          Order confirmations are shown in the browser that placed the order for 24 hours.
        </p>
        <Link
          href="/collections/all"
          className="mt-8 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-moss"
        >
          Shop all
        </Link>
      </div>
    );
  }

  const address = order.shippingAddress;
  return (
    <article data-testid="order-confirmation">
      <p className="text-xs tracking-[0.2em] text-muted uppercase">Thank you</p>
      <h1 className="mt-2 font-serif text-4xl">Your order is placed</h1>
      <p className="mt-3 text-lg">
        Order number <strong data-testid="order-number">{order.orderNumber}</strong>
      </p>
      <div className="mt-6">
        <SimulatedOrderNotice placed />
      </div>

      <section aria-labelledby="items-heading" className="mt-10">
        <h2 id="items-heading" className="font-serif text-xl">
          Items
        </h2>
        <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
          {order.lines.map((line) => (
            <li
              key={line.variantId}
              className="flex justify-between gap-4 py-3"
              data-testid="order-line"
            >
              <span>
                {line.productTitle}
                {line.variantTitle && <span className="text-muted"> · {line.variantTitle}</span>}
                <span className="text-muted">
                  {" "}
                  × {line.quantity} at {formatMoney(line.unitPrice)}
                </span>
              </span>
              <span>{formatMoney(line.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatMoney(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd>{order.shipping.amountMinor === 0 ? "Free" : formatMoney(order.shipping)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Tax</dt>
            <dd>Not charged</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-medium">
            <dt>Total</dt>
            <dd data-testid="order-total">{formatMoney(order.total)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="ship-heading" className="mt-10 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <h2 id="ship-heading" className="font-serif text-xl">
            Shipping to
          </h2>
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
            <br />
            United States
          </address>
        </div>
        <div>
          <h2 className="font-serif text-xl">Contact</h2>
          <p className="mt-2">{order.email}</p>
          <p className="mt-2 text-muted">No confirmation email is sent from this demo store.</p>
        </div>
      </section>

      <Link
        href="/collections/all"
        className="mt-12 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-moss"
      >
        Continue shopping
      </Link>
    </article>
  );
}
