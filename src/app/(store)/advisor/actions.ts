"use server";

import type { SupportRequestField } from "@/domain/advisor/support-request";
import { supportService } from "@/server/advisor";

/**
 * "Talk to a person" from the shopping advisor. A public POST endpoint: input is bounded
 * and validated with zod, and the request is only stored (no email is sent in DEMO mode).
 */

export interface SupportFormState {
  readonly status: "idle" | "success" | "error";
  readonly message: string;
  readonly fieldErrors: Partial<Record<SupportRequestField, string>>;
  /** Echo of what the shopper typed, so nothing is lost on an error. */
  readonly values: { readonly email: string; readonly message: string };
  /** Id of the stored request after a successful send. */
  readonly requestId: string | null;
}

const text = (formData: FormData, name: string, max: number) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, max) : "";
};

export async function requestHelp(
  _previous: SupportFormState,
  formData: FormData,
): Promise<SupportFormState> {
  const values = { email: text(formData, "email", 300), message: text(formData, "message", 2100) };
  const result = supportService().submit({ ...values, question: text(formData, "question", 300) });
  if (!result.ok) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: result.errors,
      values,
      requestId: null,
    };
  }
  return {
    status: "success",
    message: "Thank you. Your question is with our team.",
    fieldErrors: {},
    values: { email: "", message: "" },
    requestId: result.id,
  };
}
