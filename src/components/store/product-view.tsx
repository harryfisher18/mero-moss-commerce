import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORY_DEFINITIONS } from "@/domain/commerce/catalog";
import {
  availabilityMessage,
  optionStates,
  priceDisplay,
  relatedProducts,
  resolveSelectedVariant,
} from "@/domain/commerce/variant-selection";
import { getProduct, getProducts, getStorePolicies } from "@/server/catalog";
import { ProductArt } from "./product-art";
import { ProductCard } from "./product-card";

type RawParams = Record<string, string | string[] | undefined>;

const POLICIES_ON_PRODUCT_PAGE = new Set(["shipping", "returns", "care-and-warranty"]);

export async function ProductView({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<RawParams>;
}) {
  const [{ handle }, query] = await Promise.all([params, searchParams]);
  // The proxy already returns 404 for unknown handles; this covers a product that was
  // unpublished between the proxy check and rendering.
  const product = await getProduct(handle);
  if (!product) notFound();

  const requested = Array.isArray(query.variant) ? query.variant[0] : query.variant;
  const selected = resolveSelectedVariant(product, requested);
  if (!selected) notFound();

  const [allProducts, policies] = await Promise.all([getProducts(), getStorePolicies()]);
  const related = relatedProducts(product, allProducts, 4);
  const options = optionStates(product, selected);
  const price = priceDisplay(selected);
  const soldOut = selected.inventoryQuantity <= 0;
  const category = CATEGORY_DEFINITIONS[product.categoryHandle];
  const productPath = `/products/${product.handle}`;

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="hover:text-ink hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/collections/${product.categoryHandle}`}
              className="hover:text-ink hover:underline"
            >
              {category.title}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {product.title}
          </li>
        </ol>
      </nav>

      <article className="mt-6 grid gap-10 md:grid-cols-2" data-testid="product-detail">
        <div className="aspect-square overflow-hidden rounded-sm md:sticky md:top-6 md:self-start">
          <ProductArt
            category={product.categoryHandle}
            swatch={product.swatch}
            className={`h-full w-full ${soldOut ? "opacity-60" : ""}`}
          />
        </div>

        <div>
          <h1 className="font-serif text-4xl leading-tight">{product.title}</h1>
          <p className="mt-3 text-lg text-muted">{product.summary}</p>

          <p className="mt-6 flex items-baseline gap-3" data-testid="product-price">
            <span className="text-2xl font-medium">{price.price}</span>
            {price.compareAt && (
              <>
                <s className="text-muted">
                  <span className="sr-only">Regular price </span>
                  {price.compareAt}
                </s>
                <span className="rounded-full bg-clay px-2 py-0.5 text-xs text-paper">Sale</span>
              </>
            )}
          </p>

          <p
            data-testid="product-availability"
            className={`mt-2 text-sm ${soldOut ? "text-clay" : "text-moss"}`}
          >
            {availabilityMessage(selected)}
          </p>

          {options.map((option) => {
            const labelId = `option-${option.name.toLowerCase().replace(/\s+/g, "-")}`;
            const current = option.values.find((value) => value.selected);
            return (
              <div key={option.name} className="mt-6">
                <p id={labelId} className="text-sm font-medium">
                  {option.name}: <span className="font-normal text-muted">{current?.value}</span>
                </p>
                <ul role="list" aria-labelledby={labelId} className="mt-2 flex flex-wrap gap-2">
                  {option.values.map((value) => (
                    <li key={value.value}>
                      <Link
                        href={`${productPath}?variant=${encodeURIComponent(value.variantId)}`}
                        replace
                        scroll={false}
                        aria-current={value.selected ? "true" : undefined}
                        className={`inline-block rounded-full border px-4 py-2 text-sm ${
                          value.selected
                            ? "border-ink bg-ink text-paper"
                            : "border-line hover:border-ink"
                        } ${value.soldOut ? "line-through decoration-1" : ""}`}
                      >
                        {value.value}
                        {value.soldOut && <span className="sr-only"> (sold out)</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <p className="mt-6 text-xs text-muted">
            SKU <span data-testid="product-sku">{selected.sku}</span>
          </p>

          <div className="mt-8 space-y-4 border-t border-line pt-6 text-sm leading-relaxed">
            <p>{product.description}</p>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted">Materials</dt>
              <dd>{product.materials}</dd>
              <dt className="text-muted">Care</dt>
              <dd>{product.care}</dd>
            </dl>
          </div>

          <div className="mt-8 divide-y divide-line border-y border-line">
            {policies
              .filter((policy) => POLICIES_ON_PRODUCT_PAGE.has(policy.key))
              .map((policy) => (
                <details key={policy.key} className="py-4" data-testid={`policy-${policy.key}`}>
                  <summary className="cursor-pointer">
                    <span className="font-medium">{policy.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">{policy.summary}</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed">{policy.body}</p>
                </details>
              ))}
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-20">
          <h2 id="related-heading" className="font-serif text-2xl">
            You may also like
          </h2>
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {related.map((item) => (
              <li key={item.id}>
                <ProductCard product={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
