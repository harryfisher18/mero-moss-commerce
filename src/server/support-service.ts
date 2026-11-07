import { randomUUID } from "node:crypto";
import { z } from "zod";
import { type SupportRequestField, supportRequestSchema } from "@/domain/advisor/support-request";
import type { Database } from "@/server/db/database";
import {
  type SupportRequest,
  SqliteSupportRepository,
} from "@/server/repositories/support-repository";

export type SubmitSupportResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly errors: Partial<Record<SupportRequestField, string>> };

/**
 * "Talk to a person" requests from the shopping advisor. They are stored for the merchant
 * console. No email is sent: outbound messages need a configured, authorized provider.
 */
export class SupportService {
  private readonly repo: SqliteSupportRepository;

  constructor(
    db: Database,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = randomUUID,
  ) {
    this.repo = new SqliteSupportRepository(db);
  }

  submit(raw: unknown): SubmitSupportResult {
    const parsed = supportRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const errors: Partial<Record<SupportRequestField, string>> = {};
      for (const [field, messages] of Object.entries(z.flattenError(parsed.error).fieldErrors)) {
        const message = (messages as string[] | undefined)?.[0];
        if (message) errors[field as SupportRequestField] = message;
      }
      return { ok: false, errors };
    }
    const id = this.newId();
    this.repo.insert({ id, ...parsed.data, createdAt: this.now() });
    return { ok: true, id };
  }

  list(limit = 100): SupportRequest[] {
    return this.repo.list(limit);
  }
}
