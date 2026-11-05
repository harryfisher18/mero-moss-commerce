import Link from "next/link";
import { CATEGORY_DEFINITIONS, CATEGORY_HANDLES } from "@/domain/commerce/catalog";

const NAV = [
  { href: "/collections/all", label: "Shop all" },
  ...CATEGORY_HANDLES.map((handle) => ({
    href: `/collections/${handle}`,
    label: CATEGORY_DEFINITIONS[handle].title,
  })),
  { href: "/#policies", label: "Shipping & returns" },
];

export function StoreHeader() {
  return (
    <header className="border-b border-line bg-paper/95">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link href="/" className="font-serif text-2xl tracking-tight text-ink">
          Mero &amp; Moss
        </Link>
        <nav aria-label="Primary">
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
      </div>
    </header>
  );
}
