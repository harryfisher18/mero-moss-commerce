import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartLineControls } from "@/components/store/cart-line-controls";
import { type LineIssue, SHIPPING_RULE } from "@/domain/commerce/cart";
import { formatMoney, money } from "@/domain/commerce/money";
import { getCurrentCart } from "@/server/cart-session";

export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false },
};

export default function CartPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-12 sm:px-6">
      <h1 className="font-serif text-4xl">Your cart</h1>
      <Suspense fallback={<p className="mt-8 text-muted">Loading your cart…</p>}>
        <CartContents />
      </Suspense>
    </div>
  );
}

const ISSUE_TEXT: Record<LineIssue, (max: number) => string> = {
  unavailable: () => "This item is no longer available and isn’t included in your total.",
  sold_out: () => "This item has sold out since you added it and isn’t included in your total.",
  quantity_reduced: (max) =>
    `Only ${max} available now. Your total includes ${max}; please update the quantity.`,
};

async function CartContents() {
  const cart = await getCurrentCart();

  if (cart.lines.length === 0) {
    return (
      <div className="mt-10 rounded-sm border border-dashed border-line p-10 text-center">
        <p className="font-serif text-xl">Your cart is empty.</p>
        <p className="mt-2 text-sm text-muted">
          Find something well made for the home, the table, the desk or the road.
        </p>
        <Link
          href="/collections/all"
          className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-moss"
        >
          Shop all
        </Link>
      </div>
    );
  }

  const { totals } = cart;
  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="cart-items-heading">
        <h2 id="cart-items-heading" className="sr-only">
          Items
        </h2>
        <ul className="divide-y divide-line border-y border-line" data-testid="cart-lines">
          {cart.lines.map((line) => (
            <li
              key={line.variantId}
              className="flex flex-col gap-3 py-5 sm:flex-row sm:justify-between"
              data-testid="cart-line"
              data-variant-id={line.variantId}
            >
              <div>
                {line.productHandle && line.issue !== "unavailable" ? (
                  <Link
                    href={`/products/${line.productHandle}?variant=${encodeURIComponent(line.variantId)}`}
                    className="font-serif text-lg hover:underline"
                  >
                    {line.productTitle}
                  </Link>
                ) : (
                  <p className="font-serif text-lg">{line.productTitle}</p>
                )}
                {line.variantTitle && <p className="text-sm text-muted">{line.variantTitle}</p>}
                {line.unitPrice && (
                  <p className="mt-1 text-sm">{formatMoney(line.unitPrice)} each</p>
                )}
                {line.issue && (
                  <p className="mt-2 text-sm text-clay" role="note">
                    {ISSUE_TEXT[line.issue](line.maxQuantity)}
                  </p>
                )}
                <div className="mt-3">
                  <CartLineControls
                    variantId={line.variantId}
                    productTitle={line.productTitle}
                    quantity={line.requestedQuantity}
                    maxQuantity={line.maxQuantity}
                  />
                </div>
              </div>
              <p className="text-sm font-medium sm:text-right" data-testid="line-total">
                {line.lineTotal ? formatMoney(line.lineTotal) : "—"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <aside
        aria-labelledby="summary-heading"
        className="h-fit rounded-sm border border-line p-6"
        data-testid="cart-summary"
      >
        <h2 id="summary-heading" className="font-serif text-xl">
          Order summary
        </h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>
              Subtotal ({totals.itemCount} {totals.itemCount === 1 ? "item" : "items"})
            </dt>
            <dd data-testid="cart-subtotal">{formatMoney(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Estimated shipping</dt>
            <dd data-testid="cart-shipping">
              {totals.itemCount > 0 && totals.shippingEstimate.amountMinor === 0
                ? "Free"
                : formatMoney(totals.shippingEstimate)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Tax</dt>
            <dd>Not charged</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-medium">
            <dt>Estimated total</dt>
            <dd data-testid="cart-total">{formatMoney(totals.estimatedTotal)}</dd>
          </div>
        </dl>
        {totals.freeShippingRemaining && (
          <p className="mt-4 text-sm text-moss">
            Add {formatMoney(totals.freeShippingRemaining)} more for free standard shipping.
          </p>
        )}
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Shipping is estimated from our{" "}
          <Link href="/#shipping" className="underline underline-offset-2">
            shipping policy
          </Link>
          : free standard shipping on US orders of{" "}
          {formatMoney(money(SHIPPING_RULE.freeThresholdMinor, totals.currency))} or more,{" "}
          {formatMoney(money(SHIPPING_RULE.flatRateMinor, totals.currency))} below that. Delivery
          times are estimates. This is a demo store: no tax is calculated and no payment is ever
          taken.
        </p>
      </aside>
    </div>
  );
}
