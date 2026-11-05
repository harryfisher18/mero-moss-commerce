import { type NextRequest, NextResponse } from "next/server";
import { CATEGORY_HANDLES } from "@/domain/commerce/catalog";

/**
 * Collection pages stream, so a 404 decided during rendering would be sent with a
 * 200 status. Unknown collection handles are rejected here, before rendering starts,
 * so shoppers and crawlers get a real 404.
 */
const KNOWN_COLLECTIONS = new Set<string>(["all", ...CATEGORY_HANDLES]);

export function proxy(request: NextRequest) {
  const handle = decodeURIComponent(request.nextUrl.pathname.split("/")[2] ?? "");
  if (!KNOWN_COLLECTIONS.has(handle)) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/collections/:handle",
};
