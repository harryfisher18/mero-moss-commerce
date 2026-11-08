"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { type CheckoutField, checkoutDetailsSchema, problemMessage } from "@/domain/commerce/order";
import { trackEvent } from "@/server/analytics";
import { drainOutbox } from "@/server/automation";
import { readCartId } from "@/server/cart-session";
import { completeCheckoutSession, orderService } from "@/server/checkout-session";

/**
 * Places a SIMULATED order. This is a public POST endpoint: all input is validated with
 * zod and every price and stock value is re-read on the server. No payment is taken.
 */

const FIELDS = [
  "email",
  "fullName",
  "address1",
  "address2",
  "city",
  "region",
  "postalCode",
  "acknowledgeSimulated",
] as const satisfies readonly CheckoutField[];

export interface CheckoutActionState {
  readonly status: "idle" | "error";
  readonly formError: string | null;
  readonly problems: readonly string[];
  readonly fieldErrors: Partial<Record<CheckoutField, string>>;
  /** Echo of submitted text values so the form keeps what the shopper typed. */
  readonly values: Partial<Record<CheckoutField, string>>;
}

export async function placeOrder(
  _previous: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const raw: Partial<Record<CheckoutField, string>> = {};
  for (const field of FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string") raw[field] = value.slice(0, 300);
  }
  // Never echo the acknowledgement: the shopper must tick it deliberately each time.
  const values: Partial<Record<CheckoutField, string>> = Object.fromEntries(
    Object.entries(raw).filter(([field]) => field !== "acknowledgeSimulated"),
  );

  const parsed = checkoutDetailsSchema.safeParse({ ...raw, address2: raw.address2 ?? "" });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<CheckoutField, string>> = {};
    for (const [field, messages] of Object.entries(z.flattenError(parsed.error).fieldErrors)) {
      const message = (messages as string[] | undefined)?.[0];
      if (message) fieldErrors[field as CheckoutField] = message;
    }
    return {
      status: "error",
      formError: "Please correct the highlighted fields.",
      problems: [],
      fieldErrors,
      values,
    };
  }

  const result = orderService().placeOrder(await readCartId(), parsed.data);
  if (!result.ok) {
    return {
      status: "error",
      formError:
        result.reason === "empty_cart"
          ? "Your cart is empty, so there is nothing to order."
          : "Some items in your cart changed. Please review your cart and try again.",
      problems: result.reason === "problems" ? result.problems.map(problemMessage) : [],
      fieldErrors: {},
      values,
    };
  }

  await completeCheckoutSession(result.confirmationToken);
  await trackEvent({
    name: "purchase",
    quantity: result.order.lines.reduce((sum, line) => sum + line.quantity, 0),
    value: result.order.total,
  });
  // The order.created event is already committed; process it once the response is sent.
  after(drainOutbox);
  redirect("/checkout/confirmation");
}
