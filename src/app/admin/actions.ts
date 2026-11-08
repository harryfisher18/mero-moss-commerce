"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ORDER_STATUSES } from "@/domain/commerce/order";
import type { RawProductEdit } from "@/domain/commerce/product-edit";
import { drillPayloadSchema } from "@/domain/events/outbox";
import { formatDelay } from "@/domain/events/retry-policy";
import { safeAdminPath } from "@/domain/merchant/navigation";
import { automationService } from "@/server/automation";
import { getDatabase } from "@/server/db/client";
import { LifecycleService } from "@/server/lifecycle-service";
import { checkShopifyConnection } from "@/server/store-platform";
import { contentStudio } from "@/server/content-studio";
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

export interface AutomationActionState {
  readonly status: "idle" | "success" | "error";
  readonly message: string;
}

/** Used with useActionState; it does not need the previous state. */
export async function runDueJobs(): Promise<AutomationActionState> {
  await requireMerchant();
  const summary = automationService().runDue();
  if (summary.processed === 0) return { status: "success", message: "No jobs were due." };
  return {
    status: "success",
    message: `Processed ${summary.processed} ${summary.processed === 1 ? "event" : "events"}: ${summary.succeeded} succeeded, ${summary.retrying} scheduled for retry, ${summary.dead} dead-lettered.`,
  };
}

export async function startAutomationDrill(
  _previous: AutomationActionState,
  formData: FormData,
): Promise<AutomationActionState> {
  await requireMerchant();
  const input = drillPayloadSchema.safeParse({ scenario: formData.get("scenario") });
  if (!input.success) return { status: "error", message: "That drill does not exist." };
  const eventId = automationService().startDrill(input.data.scenario);
  redirect(`/admin/automations/${eventId}`);
}

const eventOperationSchema = z.object({
  eventId: z.string().min(1).max(100),
  operation: z.enum(["replay", "retry_now"]),
});

export async function operateEvent(
  _previous: AutomationActionState,
  formData: FormData,
): Promise<AutomationActionState> {
  await requireMerchant();
  const input = eventOperationSchema.safeParse({
    eventId: formData.get("eventId"),
    operation: formData.get("operation"),
  });
  if (!input.success) return { status: "error", message: "That request was not valid." };

  const service = automationService();
  const result =
    input.data.operation === "replay"
      ? service.replay(input.data.eventId)
      : service.retryNow(input.data.eventId);
  if (!result.ok) {
    return {
      status: "error",
      message:
        result.reason === "not_found"
          ? "This event no longer exists."
          : "That action is not available for this event's current status.",
    };
  }
  switch (result.outcome) {
    case "duplicate":
      return {
        status: "success",
        message: "Replayed. No new effects: this event's tags and previews already exist.",
      };
    case "succeeded":
      return {
        status: "success",
        message:
          input.data.operation === "replay"
            ? `Replayed and restored ${result.effects} missing ${result.effects === 1 ? "effect" : "effects"}.`
            : `Attempt ${result.attempts} succeeded.`,
      };
    case "failed":
      return {
        status: "success",
        message:
          result.delayMs === null
            ? "The replay failed. The event's earlier result is unchanged."
            : `Attempt ${result.attempts} failed. The next automatic attempt is in ${formatDelay(result.delayMs)}.`,
      };
    case "dead":
      return {
        status: "success",
        message: `Attempt ${result.attempts} failed. The event is in the dead letter queue.`,
      };
  }
}

export interface ContentActionState {
  readonly status: "idle" | "success" | "error";
  readonly message: string;
}

const productIdSchema = z.object({ productId: z.string().min(1).max(100) });

export async function generateContentDraft(
  _previous: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const session = await requireMerchant();
  const input = productIdSchema.safeParse({ productId: formData.get("productId") });
  if (!input.success) return { status: "error", message: "That request was not valid." };
  const result = await contentStudio().generate(input.data.productId, session.email);
  if (!result.ok) return { status: "error", message: "This product no longer exists." };
  return {
    status: "success",
    message: `Draft version ${String(result.draft.version)} is ready for review. Nothing has been published.`,
  };
}

const draftEditSchema = z.object({
  draftId: z.string().min(1).max(100),
  title: z.string().max(1000),
  summary: z.string().max(1000),
  seoDescription: z.string().max(1000),
});

export async function saveContentDraft(
  _previous: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const session = await requireMerchant();
  const input = draftEditSchema.safeParse(
    Object.fromEntries(
      ["draftId", "title", "summary", "seoDescription"].map((key) => [
        key,
        formData.get(key) ?? "",
      ]),
    ),
  );
  if (!input.success) return { status: "error", message: "That draft could not be read." };
  const { draftId, ...fields } = input.data;
  const result = contentStudio().edit(draftId, fields, session.email);
  if (!result.ok) {
    return {
      status: "error",
      message:
        result.reason === "not_pending"
          ? "This draft has already been decided or replaced. Reload to see the latest version."
          : "That draft could not be saved.",
    };
  }
  return {
    status: "success",
    message: `Saved as version ${String(result.draft.version)}. The checks below reflect your changes.`,
  };
}

const decisionSchema = z.object({
  draftId: z.string().min(1).max(100),
  decision: z.enum(["approve", "reject"]),
});

export async function decideContentDraft(
  _previous: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const session = await requireMerchant();
  const input = decisionSchema.safeParse({
    draftId: formData.get("draftId"),
    decision: formData.get("decision"),
  });
  if (!input.success) return { status: "error", message: "That request was not valid." };
  const studio = contentStudio();
  if (input.data.decision === "reject") {
    const result = studio.reject(input.data.draftId, session.email);
    return result.ok
      ? { status: "success", message: "Draft rejected. The live copy is unchanged." }
      : { status: "error", message: "This draft has already been decided or replaced." };
  }
  const result = studio.approve(input.data.draftId, session.email);
  if (result.ok) {
    const count = result.changedFields.length;
    return {
      status: "success",
      message:
        count === 0
          ? "Approved. The draft matched the live copy, so nothing changed."
          : `Approved and published to the demo catalog: ${String(count)} ${count === 1 ? "field" : "fields"} updated and recorded in the change history.`,
    };
  }
  switch (result.reason) {
    case "violations":
      return {
        status: "error",
        message: "This draft fails the factual checks. Fix the flagged copy, then approve.",
      };
    case "stale":
      return {
        status: "error",
        message:
          "The product changed after this draft was created. Generate a new draft from the current product.",
      };
    case "not_pending":
      return { status: "error", message: "This draft has already been decided or replaced." };
    case "not_found":
      return { status: "error", message: "This draft no longer exists." };
  }
}

export interface IntegrationActionState {
  readonly status: "idle" | "success" | "error";
  readonly message: string;
}

/** Used with useActionState. Runs read-only queries against the configured store. */
export async function verifyShopifyConnection(): Promise<IntegrationActionState> {
  await requireMerchant();
  const result = await checkShopifyConnection();
  if (!result) return { status: "error", message: "Shopify is not fully configured." };
  return result.state === "CONNECTED_VERIFIED"
    ? { status: "success", message: "Connection verified." }
    : { status: "error", message: "The connection could not be verified." };
}

export interface LifecycleActionState {
  readonly status: "idle" | "success" | "error";
  readonly message: string;
}

/** Used with useActionState. Prepares previews only; nothing is sent. */
export async function sweepAbandonedCarts(): Promise<LifecycleActionState> {
  await requireMerchant();
  const { previewed, skipped } = new LifecycleService(getDatabase()).sweepAbandonedCarts();
  return {
    status: "success",
    message:
      previewed + skipped === 0
        ? "No carts need a reminder."
        : `${String(previewed)} previewed, ${String(skipped)} skipped.`,
  };
}

const withdrawSchema = z.object({ email: z.email().max(254) });

export async function withdrawMarketingConsent(
  _previous: LifecycleActionState,
  formData: FormData,
): Promise<LifecycleActionState> {
  await requireMerchant();
  const input = withdrawSchema.safeParse({ email: formData.get("email") });
  if (!input.success) return { status: "error", message: "That request was not valid." };
  return new LifecycleService(getDatabase()).withdrawConsent(input.data.email)
    ? { status: "success", message: "Consent withdrawn." }
    : { status: "error", message: "That consent was already withdrawn." };
}
