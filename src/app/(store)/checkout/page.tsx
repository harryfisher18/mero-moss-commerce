import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/store/checkout-form";
import { SimulatedOrderNotice } from "@/components/store/simulated-order-notice";
import { TrackEvent } from "@/components/store/track-event";
import { formatMoney } from "@/domain/commerce/money";
import { getCurrentCart } from "@/server/cart-session";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-12 sm:px-6">
      <h1 className="font-serif text-4xl">Checkout</h1>
      <div className="mt-6">
        <SimulatedOrderNotice />
      </div>
      <Suspense fallback={<p className="mt-8 text-muted">Loading checkout…</p>}>
        <CheckoutContents />
      </Suspense>
    </div>
  );
}

async function CheckoutContents() {
  const cart = await getCurrentCart();

  if (cart.lines.length === 0) {
    return (
      <div className="mt-10 rounded-sm border border-dashed border-line p-10 text-center">
        <p className="font-serif text-xl">Your cart is empty.</p>
        <Link
          href="/collections/all"
          className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-moss"
        >
          Shop all
        </Link>
      </div>
    );
  }

  if (cart.hasIssues) {
    return (
      <div role="alert" className="mt-10 rounded-sm border border-clay p-6 text-sm">
        <p className="font-medium text-clay">
          Some items in your cart changed since you added them.
        </p>
        <p className="mt-1">Please review your cart before checking out.</p>
        <Link href="/cart" className="mt-4 inline-block underline underline-offset-2">
          Review your cart
        </Link>
      </div>
    );
  }

  const { totals } = cart;
  return (
    <>
      <TrackEvent name="begin_checkout" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <CheckoutForm />
        <aside
          aria-labelledby="checkout-summary-heading"
          className="h-fit rounded-sm border border-line p-6"
          data-testid="checkout-summary"
        >
          <h2 id="checkout-summary-heading" className="font-serif text-xl">
            Order summary
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            {cart.lines.map((line) => (
              <li key={line.variantId} className="flex justify-between gap-4">
                <span>
                  {line.productTitle}
                  {line.variantTitle && <span className="text-muted"> · {line.variantTitle}</span>}
                  <span className="text-muted"> × {line.quantity}</span>
                </span>
                <span>{line.lineTotal ? formatMoney(line.lineTotal) : "—"}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatMoney(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd>
                {totals.shippingEstimate.amountMinor === 0
                  ? "Free"
                  : formatMoney(totals.shippingEstimate)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Tax</dt>
              <dd>Not charged</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-medium">
              <dt>Total</dt>
              <dd data-testid="checkout-total">{formatMoney(totals.estimatedTotal)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted">
            Totals are confirmed against live stock and prices when you place the order.{" "}
            <Link href="/cart" className="underline underline-offset-2">
              Edit cart
            </Link>
          </p>
        </aside>
      </div>
    </>
  );
}
