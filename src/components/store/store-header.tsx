import Link from "next/link";
import { CartLink } from "./cart-link";
import { CATEGORY_DEFINITIONS, CATEGORY_HANDLES } from "@/domain/commerce/catalog";
import { MAX_SEARCH_LENGTH } from "@/domain/commerce/search";

const NAV = [
  { href: "/collections/all", label: "Shop all" },
  ...CATEGORY_HANDLES.map((handle) => ({
    href: `/collections/${handle}`,
    label: CATEGORY_DEFINITIONS[handle].title,
  })),
  { href: "/#policies", label: "Shipping & returns" },
  { href: "/advisor", label: "Ask an advisor" },
];

export function StoreHeader() {
  return (
    <header className="border-b border-line bg-paper/95">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
        <Link href="/" className="font-serif text-2xl tracking-tight text-ink">
          Mero &amp; Moss
        </Link>
        {/* Cart sits beside the logo on mobile and after the navigation on wider screens. */}
        <div className="ml-auto lg:order-last lg:ml-0">
          <CartLink />
        </div>
        <nav aria-label="Primary" className="w-full lg:ml-auto lg:w-auto">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-ink hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form
          action="/search"
          method="get"
          role="search"
          className="flex w-full gap-2 lg:order-last lg:w-auto"
          data-testid="header-search"
        >
          <label htmlFor="header-search-input" className="sr-only">
            Search the shop
          </label>
          <input
            id="header-search-input"
            name="q"
            type="search"
            maxLength={MAX_SEARCH_LENGTH}
            placeholder="Search"
            className="min-h-10 w-full min-w-0 rounded-full border border-line bg-white px-4 text-sm lg:w-44"
          />
          <button
            type="submit"
            className="min-h-10 rounded-full border border-ink px-4 text-sm font-medium hover:bg-ink hover:text-paper"
          >
            Search
          </button>
        </form>
      </div>
    </header>
  );
}
