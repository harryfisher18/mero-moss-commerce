import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CollectionResults } from "@/components/store/collection-results";
import {
  CATEGORY_DEFINITIONS,
  CATEGORY_HANDLES,
  type CategoryHandle,
  isCategoryHandle,
} from "@/domain/commerce/catalog";

const ALL = "all";
const COLLECTION_HANDLES: ReadonlyArray<typeof ALL | CategoryHandle> = [ALL, ...CATEGORY_HANDLES];

interface CollectionInfo {
  readonly handle: typeof ALL | CategoryHandle;
  readonly title: string;
  readonly description: string;
}

function collectionInfo(handle: string): CollectionInfo | null {
  if (handle === ALL) {
    return {
      handle: ALL,
      title: "Shop all",
      description: "Every piece in the Mero & Moss collection, from the entryway to the open road.",
    };
  }
  return isCategoryHandle(handle) ? { handle, ...CATEGORY_DEFINITIONS[handle] } : null;
}

export function generateStaticParams() {
  return COLLECTION_HANDLES.map((handle) => ({ handle }));
}

export async function generateMetadata({
  params,
}: PageProps<"/collections/[handle]">): Promise<Metadata> {
  const info = collectionInfo((await params).handle);
  return info ? { title: info.title, description: info.description } : {};
}

/**
 * Not async: `params` is only awaited inside the Suspense boundary below. Known handles are
 * still fully prerendered via generateStaticParams, and the generic `[handle]` shell can be
 * regenerated at runtime (for example after `revalidatePath`) without reading params
 * outside Suspense, which made Next.js fail the prerender with a 500 (#23).
 */
export default function CollectionPage({
  params,
  searchParams,
}: PageProps<"/collections/[handle]">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-12 sm:px-6">
      <Suspense fallback={<CollectionSkeleton />}>
        <CollectionContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function CollectionSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-5 w-32 animate-pulse rounded-sm bg-line/60" />
      <div className="mt-4 h-10 w-64 animate-pulse rounded-sm bg-line/60" />
      <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded-sm bg-line/60" />
    </div>
  );
}

/** Holds the space the results will take, so the page does not jump when they stream in. */
function ResultsSkeleton() {
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_1fr]">
      <p className="sr-only">Loading products…</p>
      <div aria-hidden="true" className="h-14 animate-pulse rounded-sm bg-line/60 lg:h-96" />
      <div aria-hidden="true">
        <div className="h-5 w-24 animate-pulse rounded-sm bg-line/60" />
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index}>
              <div className="aspect-square animate-pulse rounded-sm bg-line/60" />
              <div className="mt-3 h-5 w-3/4 animate-pulse rounded-sm bg-line/60" />
              <div className="mt-2 h-10 animate-pulse rounded-sm bg-line/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function CollectionContent({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const info = collectionInfo((await params).handle);
  // Proxy already turns unknown handles into a real 404; this guards direct renders.
  if (!info) notFound();

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex gap-2">
          <li>
            <Link href="/" className="hover:text-ink hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {info.title}
          </li>
        </ol>
      </nav>

      <h1 className="mt-4 font-serif text-4xl">{info.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{info.description}</p>

      <nav aria-label="Collections" className="mt-6">
        <ul className="flex flex-wrap gap-2 text-sm">
          {COLLECTION_HANDLES.map((handle) => {
            const current = handle === info.handle;
            return (
              <li key={handle}>
                <Link
                  href={`/collections/${handle}`}
                  aria-current={current ? "page" : undefined}
                  className={`inline-block rounded-full border px-4 py-1.5 ${
                    current ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
                  }`}
                >
                  {handle === ALL ? "All" : CATEGORY_DEFINITIONS[handle].title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Suspense fallback={<ResultsSkeleton />}>
        <CollectionResults
          basePath={`/collections/${info.handle}`}
          categoryHandle={info.handle === ALL ? undefined : info.handle}
          searchParams={searchParams}
        />
      </Suspense>
    </>
  );
}
