import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/admin/actions";
import { readMerchantSession } from "@/server/merchant-session";

export const metadata: Metadata = {
  title: { default: "Merchant console", template: "%s · Merchant console · Mero & Moss" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#fbf9f5]">
      <header className="border-b border-line bg-ink text-paper">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <p className="font-serif text-lg">
            Mero &amp; Moss <span className="text-sm text-paper/70">· Merchant console</span>
          </p>
          <span className="rounded-full border border-paper/40 px-2 py-0.5 text-xs tracking-wide uppercase">
            Demo data
          </span>
          <Suspense fallback={null}>
            <SignedInNav />
          </Suspense>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}

async function SignedInNav() {
  const session = await readMerchantSession();
  if (!session) return null;
  return (
    <nav aria-label="Merchant" className="ml-auto flex items-center gap-5 text-sm">
      <Link href="/admin/orders" className="hover:underline">
        Orders
      </Link>
      <Link href="/" className="hover:underline">
        View store
      </Link>
      <span className="hidden text-paper/70 sm:inline">{session.email}</span>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-full border border-paper/40 px-3 py-1 hover:bg-paper/10"
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
