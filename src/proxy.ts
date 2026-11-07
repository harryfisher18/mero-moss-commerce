import { type NextRequest, NextResponse } from "next/server";
import { CATEGORY_HANDLES } from "@/domain/commerce/catalog";
import { getDatabase } from "@/server/db/client";
import { MERCHANT_COOKIE, MerchantAuthService } from "@/server/merchant-auth-service";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";

/**
 * Collection and product pages stream, so a 404 decided during rendering would be sent
 * with a 200 status. Unknown handles are rejected here, before rendering starts, so
 * shoppers and crawlers get a real 404. Product checks are a single indexed lookup.
 *
 * Merchant routes are redirected to the login page before rendering when there is no
 * valid session. This is an optimistic check: every merchant page and Server Action
 * re-verifies the session itself (see requireMerchant).
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
  if (section === "admin") {
    const signedIn =
      new MerchantAuthService(getDatabase()).verify(request.cookies.get(MERCHANT_COOKIE)?.value) !==
      null;
    const isLogin = request.nextUrl.pathname === "/admin/login";
    if (!signedIn && !isLogin) {
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(login);
    }
    if (signedIn && (isLogin || request.nextUrl.pathname === "/admin")) {
      return NextResponse.redirect(new URL("/admin/orders", request.url));
    }
    return NextResponse.next();
  }
  if (section === "products") {
    const exists = new SqliteCatalogRepository(getDatabase()).isActiveProductHandle(handle);
    if (!exists) return notFound(request);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/collections/:handle", "/products/:handle", "/admin", "/admin/:path*"],
};
