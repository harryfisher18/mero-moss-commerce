import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDatabase } from "@/server/db/client";
import {
  MERCHANT_COOKIE,
  MerchantAuthService,
  type MerchantSession,
} from "@/server/merchant-auth-service";
import { MerchantOrderService } from "@/server/merchant-order-service";
import { ProductEditService } from "@/server/product-edit-service";

export function merchantAuth(): MerchantAuthService {
  return new MerchantAuthService(getDatabase());
}

export function merchantOrders(): MerchantOrderService {
  return new MerchantOrderService(getDatabase());
}

export function productEditor(): ProductEditService {
  return new ProductEditService(getDatabase());
}

export async function readMerchantSession(): Promise<MerchantSession | null> {
  // Session validity depends on the current time, so this must never run while prerendering.
  await connection();
  return merchantAuth().verify((await cookies()).get(MERCHANT_COOKIE)?.value);
}

/**
 * Data-access guard for every merchant page and Server Action. Proxy already redirects
 * unauthenticated requests, but authorization is always re-checked close to the data.
 */
export async function requireMerchant(): Promise<MerchantSession> {
  const session = await readMerchantSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** Only callable from Server Actions or Route Handlers. */
export async function startMerchantSession(token: string, expiresAt: string): Promise<void> {
  (await cookies()).set(MERCHANT_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

/** Only callable from Server Actions or Route Handlers. */
export async function endMerchantSession(): Promise<void> {
  const store = await cookies();
  merchantAuth().logout(store.get(MERCHANT_COOKIE)?.value);
  store.delete(MERCHANT_COOKIE);
}
