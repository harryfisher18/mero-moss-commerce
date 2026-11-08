"use server";

import { z } from "zod";
import { cartItemCount, rejectionMessage } from "@/domain/commerce/cart";
import { MAX_QUANTITY_PER_LINE } from "@/domain/commerce/variant-selection";
import { trackAddToCart } from "@/server/analytics";
import { cartService, readCartId, writeCartId } from "@/server/cart-session";

/**
 * Cart Server Actions. They are public POST endpoints: every input is validated here and
 * every rule is re-checked against the database by CartService. No price, title or stock
 * value is ever accepted from the client. Cart data is never cached, so the calling form
 * refreshes the router on success (see useRefreshOnSuccess) instead of revalidating paths.
 */

export interface CartActionState {
  readonly status: "idle" | "success" | "error";
  readonly message: string;
}

const variantId = z.string().trim().min(1).max(100);

const addSchema = z.object({
  variantId,
  quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
});

const lineSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("update"),
    variantId,
    quantity: z.coerce.number().int().min(0).max(MAX_QUANTITY_PER_LINE),
  }),
  z.object({ intent: z.literal("remove"), variantId }),
]);

export async function addToCart(
  _previous: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const input = addSchema.safeParse({
    variantId: formData.get("variantId"),
    quantity: formData.get("quantity"),
  });
  if (!input.success) {
    return {
      status: "error",
      message: `Please choose a quantity between 1 and ${MAX_QUANTITY_PER_LINE}.`,
    };
  }

  const service = cartService();
  const { cartId, result } = service.add(
    await readCartId(),
    input.data.variantId,
    input.data.quantity,
  );
  if (!result.ok) {
    return { status: "error", message: rejectionMessage(result.reason, result.maxQuantity) };
  }

  await writeCartId(cartId);
  await trackAddToCart(input.data.variantId, input.data.quantity);
  const count = cartItemCount(result.lines);
  return {
    status: "success",
    message: `Added to your cart. You now have ${count} ${count === 1 ? "item" : "items"}.`,
  };
}

export async function updateCartLine(
  _previous: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const input = lineSchema.safeParse({
    intent: formData.get("intent"),
    variantId: formData.get("variantId"),
    quantity: formData.get("quantity") ?? undefined,
  });
  if (!input.success) {
    return {
      status: "error",
      message: `Please choose a quantity between 0 and ${MAX_QUANTITY_PER_LINE}.`,
    };
  }

  const service = cartService();
  const cartId = await readCartId();
  const result =
    input.data.intent === "remove"
      ? service.remove(cartId, input.data.variantId)
      : service.setQuantity(cartId, input.data.variantId, input.data.quantity);

  if (!result.ok) {
    return {
      status: "error",
      message: rejectionMessage(result.reason, result.maxQuantity, "update"),
    };
  }
  return {
    status: "success",
    message: input.data.intent === "remove" ? "Item removed." : "Quantity updated.",
  };
}
