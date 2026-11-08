import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CATEGORY_DEFINITIONS, priceRange, totalInventory } from "@/domain/commerce/catalog";
import { formatMoney } from "@/domain/commerce/money";
import { productEditor, requireMerchant } from "@/server/merchant-session";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <>
      <h1 className="font-serif text-3xl">Products</h1>
      <p className="mt-1 text-sm text-muted">
        Demo catalog. Edits to price, stock, copy and status apply to the storefront immediately.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading products…</p>}>
        <ProductsTable />
      </Suspense>
    </>
  );
}

const STATUS_STYLES = {
  active: "bg-moss/15 text-moss",
  draft: "bg-clay/15 text-clay",
  archived: "bg-line text-ink",
} as const;

async function ProductsTable() {
  await requireMerchant();
  const products = productEditor().listAll();

  return (
    <div className="mt-6 overflow-x-auto rounded-sm border border-line bg-white">
      <table className="w-full min-w-[44rem] text-left text-sm" data-testid="products-table">
        <caption className="sr-only">Products by category</caption>
        <thead className="border-b border-line bg-paper text-xs tracking-wide text-muted uppercase">
          <tr>
            <th scope="col" className="px-4 py-3">
              Product
            </th>
            <th scope="col" className="px-4 py-3">
              Category
            </th>
            <th scope="col" className="px-4 py-3">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Variants
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Stock
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Price
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {products.map((product) => {
            const range = priceRange(product);
            const stock = totalInventory(product);
            return (
              <tr key={product.id} data-testid="product-row" data-handle={product.handle}>
                <th scope="row" className="px-4 py-3 font-medium">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="underline underline-offset-2"
                  >
                    {product.title}
                  </Link>
                </th>
                <td className="px-4 py-3">{CATEGORY_DEFINITIONS[product.categoryHandle].title}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[product.status]}`}
                  >
                    {product.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{product.variants.length}</td>
                <td className={`px-4 py-3 text-right ${stock === 0 ? "text-clay" : ""}`}>
                  {stock}
                </td>
                <td className="px-4 py-3 text-right">
                  {range.min.amountMinor === range.max.amountMinor
                    ? formatMoney(range.min)
                    : `${formatMoney(range.min)} – ${formatMoney(range.max)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
