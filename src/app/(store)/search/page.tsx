import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProductCard } from "@/components/store/product-card";
import { normalizeSearch, searchProducts } from "@/domain/commerce/search";
import { getProducts } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the Mero & Moss collection.",
  robots: { index: false },
};

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-12 sm:px-6">
      <h1 className="font-serif text-4xl">Search</h1>
      <Suspense fallback={<p className="mt-8 text-muted">Searching…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = normalizeSearch((await searchParams).q);
  if (!query) {
    return (
      <p className="mt-4 text-muted" data-testid="search-prompt">
        Type what you&rsquo;re looking for in the search box above, such as &ldquo;linen&rdquo; or
        &ldquo;desk lamp&rdquo;.
      </p>
    );
  }

  await connection();
  const results = searchProducts(query, await getProducts());

  return (
    <section aria-labelledby="search-results-heading" data-testid="search-results">
      <h2 id="search-results-heading" className="mt-4 text-muted" aria-live="polite">
        {results.length} {results.length === 1 ? "result" : "results"} for &ldquo;{query}&rdquo;
      </h2>
      {results.length === 0 ? (
        <div
          className="mt-8 rounded-sm border border-dashed border-line p-10 text-center"
          data-testid="search-empty"
        >
          <p className="font-serif text-xl">Nothing in the shop matches that.</p>
          <p className="mt-2 text-sm text-muted">
            Try fewer or different words, or describe what you need to our shopping advisor.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm">
            <Link
              href={`/advisor?q=${encodeURIComponent(query)}`}
              className="rounded-full bg-ink px-5 py-2.5 font-medium text-paper hover:bg-moss"
            >
              Ask the shopping advisor
            </Link>
            <Link
              href="/collections/all"
              className="rounded-full border border-ink px-5 py-2.5 font-medium hover:bg-ink hover:text-paper"
            >
              Shop all
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {results.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
