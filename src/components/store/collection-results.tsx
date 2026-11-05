import Link from "next/link";
import type { CategoryHandle } from "@/domain/commerce/catalog";
import {
  type CollectionQuery,
  hasActiveFilters,
  optionParamKey,
  PRICE_BANDS,
  type PriceBandKey,
  queryCollection,
  type RawSearchParams,
  serializeCollectionQuery,
  SORT_KEYS,
  SORT_LABELS,
} from "@/domain/commerce/collection-query";
import { getProducts } from "@/server/catalog";
import { AutoSubmitForm } from "./auto-submit-form";
import { ProductCard } from "./product-card";

const PRICE_BAND_ENTRIES = Object.entries(PRICE_BANDS) as Array<
  [PriceBandKey, (typeof PRICE_BANDS)[PriceBandKey]]
>;

export async function CollectionResults({
  basePath,
  categoryHandle,
  searchParams,
}: {
  basePath: string;
  categoryHandle?: CategoryHandle;
  searchParams: Promise<RawSearchParams>;
}) {
  const [params, products] = await Promise.all([
    searchParams,
    getProducts(categoryHandle ? { categoryHandle } : {}),
  ]);
  const { query, facets, page } = queryCollection(products, params);
  const href = (next: CollectionQuery) => `${basePath}${serializeCollectionQuery(next)}`;
  const filtersActive = hasActiveFilters(query);
  const stateKey = serializeCollectionQuery({ ...query, page: 1 });
  const visibleFacets = facets.filter((facet) => facet.values.length > 1);

  const chips: Array<{ label: string; href: string }> = [];
  if (query.inStockOnly) {
    chips.push({ label: "In stock", href: href({ ...query, inStockOnly: false, page: 1 }) });
  }
  if (query.price) {
    chips.push({
      label: PRICE_BANDS[query.price].label,
      href: href({ ...query, price: null, page: 1 }),
    });
  }
  for (const [name, values] of Object.entries(query.options)) {
    for (const value of values) {
      const remaining = values.filter((v) => v !== value);
      const options = { ...query.options };
      if (remaining.length > 0) options[name] = remaining;
      else delete options[name];
      chips.push({ label: `${name}: ${value}`, href: href({ ...query, options, page: 1 }) });
    }
  }

  const sortForm = (
    <AutoSubmitForm
      action={basePath}
      label="Sort products"
      stateKey={stateKey}
      className="flex items-center gap-2"
    >
      <label htmlFor="sort" className="text-sm text-muted">
        Sort by
      </label>
      <select
        id="sort"
        name="sort"
        defaultValue={query.sort}
        className="rounded-sm border border-line bg-paper px-3 py-2 text-sm"
      >
        {SORT_KEYS.map((key) => (
          <option key={key} value={key}>
            {SORT_LABELS[key]}
          </option>
        ))}
      </select>
      {query.inStockOnly && <input type="hidden" name="availability" value="in-stock" />}
      {query.price && <input type="hidden" name="price" value={query.price} />}
      {Object.entries(query.options).flatMap(([name, values]) =>
        values.map((value) => (
          <input key={`${name}-${value}`} type="hidden" name={optionParamKey(name)} value={value} />
        )),
      )}
    </AutoSubmitForm>
  );

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_1fr]">
      <aside>
        <details
          open={filtersActive || undefined}
          className="rounded-sm border border-line p-4 lg:border-0 lg:p-0"
        >
          <summary className="cursor-pointer font-medium">
            Filters{filtersActive ? ` (${chips.length} active)` : ""}
          </summary>
          <AutoSubmitForm
            action={basePath}
            label="Filter products"
            stateKey={stateKey}
            className="mt-4 space-y-6"
          >
            {query.sort !== "featured" && <input type="hidden" name="sort" value={query.sort} />}

            <fieldset>
              <legend className="text-sm font-medium">Availability</legend>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="availability"
                  value="in-stock"
                  defaultChecked={query.inStockOnly}
                />
                In stock only
              </label>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium">Price</legend>
              <div className="mt-2 space-y-1.5">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="price" value="" defaultChecked={!query.price} />
                  Any price
                </label>
                {PRICE_BAND_ENTRIES.map(([key, band]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="price"
                      value={key}
                      defaultChecked={query.price === key}
                    />
                    {band.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {visibleFacets.map((facet) => (
              <fieldset key={facet.name}>
                <legend className="text-sm font-medium">{facet.name}</legend>
                <div className="mt-2 space-y-1.5">
                  {facet.values.map(({ value, productCount }) => (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name={optionParamKey(facet.name)}
                        value={value}
                        defaultChecked={query.options[facet.name]?.includes(value) ?? false}
                      />
                      {value} <span className="text-muted">({productCount})</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </AutoSubmitForm>
        </details>
      </aside>

      <section aria-labelledby="results-heading">
        <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="results-heading" className="text-sm text-muted" aria-live="polite">
            {page.total} {page.total === 1 ? "product" : "products"}
          </h2>
          {sortForm}
        </div>

        {chips.length > 0 && (
          <ul aria-label="Active filters" className="mt-4 flex flex-wrap gap-2 text-sm">
            {chips.map((chip) => (
              <li key={chip.label}>
                <Link
                  href={chip.href}
                  scroll={false}
                  className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 hover:border-ink"
                >
                  {chip.label}
                  <span aria-hidden="true">×</span>
                  <span className="sr-only">(remove filter)</span>
                </Link>
              </li>
            ))}
            <li>
              <Link href={basePath} scroll={false} className="inline-block px-2 py-1 underline">
                Clear all
              </Link>
            </li>
          </ul>
        )}

        {page.total === 0 ? (
          <div className="mt-10 rounded-sm border border-dashed border-line p-10 text-center">
            <p className="font-serif text-xl">No products match these filters.</p>
            <p className="mt-2 text-sm text-muted">
              Try removing a filter or browsing the whole collection.
            </p>
            <Link
              href={basePath}
              className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-moss"
            >
              Clear all filters
            </Link>
          </div>
        ) : (
          <ul
            data-testid="collection-grid"
            className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3"
          >
            {page.items.map(({ product, matches }) => (
              <li key={product.id}>
                <ProductCard product={product} priceVariants={matches} />
              </li>
            ))}
          </ul>
        )}

        {page.pageCount > 1 && (
          <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-2">
            {page.page > 1 && (
              <Link
                href={href({ ...query, page: page.page - 1 })}
                className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink"
              >
                Previous
              </Link>
            )}
            {Array.from({ length: page.pageCount }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={href({ ...query, page: n })}
                aria-current={n === page.page ? "page" : undefined}
                aria-label={`Page ${n}`}
                className={`rounded-full px-4 py-2 text-sm ${
                  n === page.page ? "bg-ink text-paper" : "border border-line hover:border-ink"
                }`}
              >
                {n}
              </Link>
            ))}
            {page.page < page.pageCount && (
              <Link
                href={href({ ...query, page: page.page + 1 })}
                className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink"
              >
                Next
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
