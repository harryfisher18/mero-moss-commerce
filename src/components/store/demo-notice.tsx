import Link from "next/link";

/** Always-visible disclosure that this is a demo store with simulated orders. */
export function DemoNotice() {
  return (
    <div role="note" className="bg-moss px-4 py-2 text-center text-xs text-paper sm:text-sm">
      Demo store: products and stock are sample data and orders are simulated. No payment is ever
      taken.{" "}
      <Link href="/#demo-store" className="underline underline-offset-2">
        Learn more
      </Link>
    </div>
  );
}
