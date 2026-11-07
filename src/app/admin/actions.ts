"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ORDER_STATUSES } from "@/domain/commerce/order";
import { safeAdminPath } from "@/domain/merchant/navigation";
import {
  endMerchantSession,
  merchantAuth,
  merchantOrders,
  requireMerchant,
  startMerchantSession,
} from "@/server/merchant-session";

/**
 * Merchant console Server Actions. They are public POST endpoints, so every action except
 * login re-verifies the merchant session itself, and all input is validated with zod.
 */

export interface LoginState {
  readonly error: string | null;
  readonly email: string;
}

const loginSchema = z.object({
  email: z.string().trim().max(254),
  password: z.string().max(200),
  next: z.string().max(200).optional(),
});

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const input = loginSchema.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    next: formData.get("next") ?? undefined,
  });
  if (!input.success) return { error: "Enter your email and password.", email: "" };

  const result = merchantAuth().login(input.data.email, input.data.password);
  if (!result.ok) {
    return {
      error:
        result.reason === "locked"
          ? "Too many failed attempts. Please wait 15 minutes and try again."
          : "That email and password combination is not recognized.",
      email: input.data.email,
    };
  }
  await startMerchantSession(result.token, result.expiresAt);
  redirect(safeAdminPath(input.data.next));
}

export async function logout(): Promise<void> {
  await endMerchantSession();
  redirect("/admin/login");
}

export interface TransitionState {
  readonly status: "idle" | "success" | "error";
  readonly message: string;
}

const transitionSchema = z.object({
  orderId: z.uuid(),
  to: z.enum(ORDER_STATUSES),
});

export async function transitionOrder(
  _previous: TransitionState,
  formData: FormData,
): Promise<TransitionState> {
  const session = await requireMerchant();
  const input = transitionSchema.safeParse({
    orderId: formData.get("orderId"),
    to: formData.get("to"),
  });
  if (!input.success) return { status: "error", message: "That request was not valid." };

  const result = merchantOrders().transition(input.data.orderId, input.data.to, session.email);
  if (!result.ok) {
    return {
      status: "error",
      message:
        result.reason === "not_found"
          ? "This order no longer exists."
          : "That status change is not allowed from the order's current status.",
    };
  }
  return { status: "success", message: "Order status updated." };
}
