import Link from "next/link";
import { Suspense } from "react";
import { getCurrentCartCount } from "@/server/cart-session";

const linkClass =
  "inline-flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-sm text-ink hover:border-ink";

/** Header cart link. The count reads the cart cookie, so it streams at request time. */
export function CartLink() {
  return (
    <Suspense
      fallback={
        <Link href="/cart" className={linkClass}>
          Cart
        </Link>
      }
    >
      <CartLinkWithCount />
    </Suspense>
  );
}

async function CartLinkWithCount() {
  const count = await getCurrentCartCount();
  return (
    <Link
      href="/cart"
      className={linkClass}
      aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
      data-testid="header-cart"
    >
      Cart
      <span
        aria-hidden="true"
        className="min-w-5 rounded-full bg-ink px-1.5 text-center text-xs text-paper"
      >
        {count}
      </span>
    </Link>
  );
}
