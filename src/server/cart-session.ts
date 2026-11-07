import { cookies } from "next/headers";
import { cartItemCount } from "@/domain/commerce/cart";
import { CartService } from "@/server/cart-service";
import { getDatabase } from "@/server/db/client";

/** The cart cookie holds only an opaque random id; prices and stock live on the server. */
export const CART_COOKIE = "mm_cart";
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export function cartService(): CartService {
  return new CartService(getDatabase());
}

export async function readCartId(): Promise<string | undefined> {
  return (await cookies()).get(CART_COOKIE)?.value;
}

/** Only callable from Server Actions or Route Handlers. */
export async function writeCartId(cartId: string): Promise<void> {
  (await cookies()).set(CART_COOKIE, cartId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS_SECONDS,
  });
}

/** Request-time read of the current shopper's priced cart. */
export async function getCurrentCart() {
  return cartService().getCart(await readCartId());
}

export async function getCurrentCartCount(): Promise<number> {
  return cartItemCount(cartService().getLines(await readCartId()));
}
