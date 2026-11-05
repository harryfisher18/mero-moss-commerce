import Link from "next/link";
import { DemoNotice } from "@/components/store/demo-notice";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";

export default function NotFound() {
  return (
    <>
      <DemoNotice />
      <StoreHeader />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-24 text-center sm:px-6">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Page not found</p>
        <h1 className="mt-4 font-serif text-4xl">We couldn’t find that page.</h1>
        <p className="mt-4 text-muted">
          It may have moved, or the link may be out of date. The full collection is a good place to
          start.
        </p>
        <Link
          href="/collections/all"
          className="mt-8 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-moss"
        >
          Shop all
        </Link>
      </main>
      <StoreFooter />
    </>
  );
}
