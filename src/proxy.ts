import { type NextRequest, NextResponse } from "next/server";
import { CATEGORY_HANDLES } from "@/domain/commerce/catalog";
import { getDatabase } from "@/server/db/client";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";

/**
 * Collection and product pages stream, so a 404 decided during rendering would be sent
 * with a 200 status. Unknown handles are rejected here, before rendering starts, so
 * shoppers and crawlers get a real 404. Product checks are a single indexed lookup.
 */
const KNOWN_COLLECTIONS = new Set<string>(["all", ...CATEGORY_HANDLES]);

function notFound(request: NextRequest) {
  return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
}

function segment(request: NextRequest): string {
  try {
    return decodeURIComponent(request.nextUrl.pathname.split("/")[2] ?? "");
  } catch {
    return "";
  }
}

export function proxy(request: NextRequest) {
  const [, section] = request.nextUrl.pathname.split("/");
  const handle = segment(request);

  if (section === "collections" && !KNOWN_COLLECTIONS.has(handle)) {
    return notFound(request);
  }
  if (section === "products") {
    const exists = new SqliteCatalogRepository(getDatabase()).isActiveProductHandle(handle);
    if (!exists) return notFound(request);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/collections/:handle", "/products/:handle"],
};
