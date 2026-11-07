"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ORDER_STATUSES } from "@/domain/commerce/order";
import type { RawProductEdit } from "@/domain/commerce/product-edit";
import { safeAdminPath } from "@/domain/merchant/navigation";
import {
  endMerchantSession,
  merchantAuth,
  merchantOrders,
  productEditor,
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

export interface ProductEditState {
  readonly status: "idle" | "success" | "error";
  readonly message: string;
  readonly errors: Readonly<Record<string, string>>;
  /** Submitted values, echoed back on errors so nothing the merchant typed is lost. */
  readonly values: RawProductEdit | null;
}

const MAX_VARIANTS = 50;
const shortText = z.string().max(4000);

export async function saveProduct(
  _previous: ProductEditState,
  formData: FormData,
): Promise<ProductEditState> {
  const session = await requireMerchant();

  const strings = (name: string) =>
    formData.getAll(name).map((value) => (typeof value === "string" ? value : ""));
  const ids = strings("variantId");
  const prices = strings("price");
  const compareAts = strings("compareAt");
  const stocks = strings("stock");
  const header = z
    .object({
      productId: z.string().min(1).max(100),
      expectedUpdatedAt: z.string().min(1).max(40),
      title: shortText,
      summary: shortText,
      description: shortText,
      status: z.string().max(20),
    })
    .safeParse(
      Object.fromEntries(
        ["productId", "expectedUpdatedAt", "title", "summary", "description", "status"].map(
          (key) => [key, formData.get(key) ?? ""],
        ),
      ),
    );
  const shapeOk =
    header.success &&
    ids.length > 0 &&
    ids.length <= MAX_VARIANTS &&
    [prices, compareAts, stocks].every((list) => list.length === ids.length);
  if (!header.success || !shapeOk) {
    return {
      status: "error",
      message: "This form was incomplete. Reload the page and try again.",
      errors: {},
      values: null,
    };
  }

  const raw: RawProductEdit = {
    title: header.data.title,
    summary: header.data.summary,
    description: header.data.description,
    status: header.data.status,
    variants: ids.map((id, index) => ({
      id,
      price: prices[index] ?? "",
      compareAt: compareAts[index] ?? "",
      stock: stocks[index] ?? "",
    })),
  };

  const result = productEditor().save(
    header.data.productId,
    header.data.expectedUpdatedAt,
    raw,
    session.email,
  );
  if (!result.ok) {
    switch (result.reason) {
      case "invalid":
        return {
          status: "error",
          message: "Please fix the highlighted fields.",
          errors: result.errors,
          values: raw,
        };
      case "conflict":
        return {
          status: "error",
          message:
            "This product was changed after you opened it. Reload to see the latest version, then reapply your edits.",
          errors: {},
          values: raw,
        };
      case "not_found":
        return {
          status: "error",
          message: "This product no longer exists.",
          errors: {},
          values: null,
        };
    }
  }
  const count = result.changes.length;
  return {
    status: "success",
    message:
      count === 0
        ? "No changes to save."
        : `Saved ${count} ${count === 1 ? "change" : "changes"}. The storefront now shows the update.`,
    errors: {},
    values: null,
  };
}
