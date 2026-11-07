import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductEditor } from "@/components/admin/product-editor";
import { CATEGORY_DEFINITIONS } from "@/domain/commerce/catalog";
import { productEditor, requireMerchant } from "@/server/merchant-session";

export const metadata: Metadata = { title: "Edit product" };

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  summary: "Summary",
  description: "Description",
  status: "Status",
  price: "Price",
  compareAtPrice: "Compare-at price",
  inventoryQuantity: "Stock",
};

export default function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  return (
    <>
      <Link href="/admin/products" className="text-sm text-muted hover:text-ink hover:underline">
        ← All products
      </Link>
      <Suspense fallback={<p className="mt-8 text-muted">Loading product…</p>}>
        <EditProduct params={params} />
      </Suspense>
    </>
  );
}

async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireMerchant();
  const { id } = await params;
  const service = productEditor();
  const product = service.get(id);
  if (!product) notFound();
  const history = service.audit(product.id);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-serif text-3xl">{product.title}</h1>
        <p className="text-sm text-muted">{CATEGORY_DEFINITIONS[product.categoryHandle].title}</p>
        {product.status === "active" && (
          <Link
            href={`/products/${product.handle}`}
            className="text-sm underline underline-offset-2"
            data-testid="view-in-store"
          >
            View in store
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <ProductEditor product={product} />

        <section
          aria-labelledby="history-heading"
          className="h-fit rounded-sm border border-line bg-white p-4 text-sm"
        >
          <h2 id="history-heading" className="font-medium">
            Change history
          </h2>
          {history.length === 0 ? (
            <p className="mt-2 text-muted">No edits yet. Seeded demo data.</p>
          ) : (
            <ol className="mt-2 space-y-3" data-testid="change-history">
              {history.map((event, index) => (
                <li key={index}>
                  <p>
                    <span className="font-medium">{FIELD_LABELS[event.field] ?? event.field}</span>
                    {event.entityType === "variant" && (
                      <span className="text-muted"> · {event.label}</span>
                    )}
                  </p>
                  <p className="break-words">
                    <span className="text-muted line-through">{event.before || "—"}</span> →{" "}
                    <span>{event.after || "—"}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {dateFormat.format(new Date(event.createdAt))} UTC · {event.actor}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
