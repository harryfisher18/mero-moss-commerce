import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductView } from "@/components/store/product-view";
import { getProduct } from "@/server/catalog";

export async function generateMetadata({
  params,
}: PageProps<"/products/[handle]">): Promise<Metadata> {
  const product = await getProduct((await params).handle);
  return product ? { title: product.title, description: product.summary } : {};
}

export default function ProductPage({ params, searchParams }: PageProps<"/products/[handle]">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-12 sm:px-6">
      <Suspense fallback={<ProductSkeleton />}>
        <ProductView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-10 md:grid-cols-2">
      <div className="aspect-square animate-pulse rounded-sm bg-line/60" />
      <div className="space-y-4">
        <div className="h-10 w-2/3 animate-pulse rounded-sm bg-line/60" />
        <div className="h-6 w-1/3 animate-pulse rounded-sm bg-line/60" />
        <div className="h-24 animate-pulse rounded-sm bg-line/60" />
      </div>
    </div>
  );
}
