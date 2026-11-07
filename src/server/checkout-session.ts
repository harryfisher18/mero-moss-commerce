import { cookies } from "next/headers";
import { CART_COOKIE } from "@/server/cart-session";
import { getDatabase } from "@/server/db/client";
import { OrderService } from "@/server/order-service";

/**
 * The confirmation page is resolved from an httpOnly cookie holding a random token, so
 * order details (which include a name and address) are never reachable by guessing an
 * order number in a URL.
 */
export const LAST_ORDER_COOKIE = "mm_last_order";
const ONE_DAY_SECONDS = 60 * 60 * 24;

export function orderService(): OrderService {
  return new OrderService(getDatabase());
}

/** Only callable from Server Actions or Route Handlers. */
export async function completeCheckoutSession(confirmationToken: string): Promise<void> {
  const store = await cookies();
  store.set(LAST_ORDER_COOKIE, confirmationToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/checkout",
    maxAge: ONE_DAY_SECONDS,
  });
  store.delete(CART_COOKIE);
}

export async function getLastOrder() {
  return orderService().getOrderByConfirmationToken(
    (await cookies()).get(LAST_ORDER_COOKIE)?.value,
  );
}
