import { Suspense } from "react";
import { ProductCard } from "@/components/store/product-card";
import {
  getCategories,
  getFeaturedProducts,
  getProducts,
  getStorePolicies,
} from "@/server/catalog";

export default function HomePage() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Mero &amp; Moss</p>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">
          Well-made essentials for everyday living.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Considered pieces for home organization, the table and kitchen, the workspace, and travel,
          chosen to be used every day and kept for years.
        </p>
        <a
          href="#featured"
          className="mt-8 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-moss"
        >
          Shop featured pieces
        </a>
      </section>

      <section
        id="featured"
        aria-labelledby="featured-heading"
        className="mx-auto w-full max-w-6xl scroll-mt-6 px-4 py-12 sm:px-6"
      >
        <h2 id="featured-heading" className="font-serif text-3xl">
          Featured pieces
        </h2>
        <Suspense fallback={<GridSkeleton count={6} />}>
          <FeaturedProducts />
        </Suspense>
      </section>

      <section
        id="categories"
        aria-labelledby="categories-heading"
        className="mx-auto w-full max-w-6xl scroll-mt-6 px-4 py-12 sm:px-6"
      >
        <h2 id="categories-heading" className="font-serif text-3xl">
          Shop by category
        </h2>
        <Suspense fallback={<GridSkeleton count={4} />}>
          <CategorySections />
        </Suspense>
      </section>

      <section
        id="policies"
        aria-labelledby="policies-heading"
        className="mx-auto w-full max-w-6xl scroll-mt-6 px-4 py-12 sm:px-6"
      >
        <h2 id="policies-heading" className="font-serif text-3xl">
          Shipping, returns &amp; care
        </h2>
        <Suspense fallback={<p className="mt-6 text-muted">Loading store policies…</p>}>
          <Policies />
        </Suspense>
      </section>
    </>
  );
}

async function FeaturedProducts() {
  const products = await getFeaturedProducts(6);
  if (products.length === 0) {
    return <p className="mt-6 text-muted">New pieces are on their way. Check back soon.</p>;
  }
  return (
    <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

async function CategorySections() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  return (
    <div className="mt-8 space-y-16">
      {categories.map((category) => {
        const inCategory = products.filter((p) => p.categoryHandle === category.handle);
        return (
          <section
            key={category.id}
            aria-labelledby={`category-${category.handle}`}
            data-testid="category-section"
          >
            <div className="flex flex-col gap-1 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 id={`category-${category.handle}`} className="font-serif text-2xl">
                  {category.title}
                </h3>
                <p className="mt-1 text-sm text-muted">{category.description}</p>
              </div>
              <p className="text-sm text-muted">
                {inCategory.length} {inCategory.length === 1 ? "piece" : "pieces"}
              </p>
            </div>
            {inCategory.length === 0 ? (
              <p className="mt-6 text-muted">Nothing in this category right now.</p>
            ) : (
              <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
                {inCategory.map((product) => (
                  <li key={product.id}>
                    <ProductCard product={product} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

async function Policies() {
  const policies = await getStorePolicies();
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      {policies.map((policy) => (
        <details
          key={policy.key}
          id={policy.key}
          className="scroll-mt-6 rounded-sm border border-line bg-white/40 p-5"
        >
          <summary className="cursor-pointer">
            <span className="font-serif text-lg">{policy.title}</span>
            <span className="mt-1 block text-sm text-muted">{policy.summary}</span>
          </summary>
          <p className="mt-4 text-sm leading-relaxed">{policy.body}</p>
        </details>
      ))}
    </div>
  );
}

function GridSkeleton({ count }: { count: number }) {
  return (
    <ul
      aria-hidden="true"
      className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="aspect-square animate-pulse rounded-sm bg-line/60" />
      ))}
    </ul>
  );
}
