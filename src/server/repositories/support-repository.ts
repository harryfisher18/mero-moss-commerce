import { z } from "zod";
import type { SupportRequestInput } from "@/domain/advisor/support-request";
import type { Database } from "@/server/db/database";

export interface SupportRequest extends SupportRequestInput {
  readonly id: string;
  readonly createdAt: string;
}

const row = z.object({
  id: z.string(),
  email: z.string(),
  message: z.string(),
  question: z.string(),
  created_at: z.string(),
});

export class SqliteSupportRepository {
  constructor(private readonly db: Database) {}

  insert(request: SupportRequest): void {
    this.db
      .prepare(
        "INSERT INTO support_requests (id, email, message, question, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(request.id, request.email, request.message, request.question, request.createdAt);
  }

  count(): number {
    return z
      .object({ n: z.number().int() })
      .parse(this.db.prepare("SELECT COUNT(*) AS n FROM support_requests").get()).n;
  }

  list(limit = 100): SupportRequest[] {
    return this.db
      .prepare(
        `SELECT id, email, message, question, created_at FROM support_requests
         ORDER BY created_at DESC, rowid DESC LIMIT ?`,
      )
      .all(limit)
      .map((raw) => {
        const r = row.parse(raw);
        return {
          id: r.id,
          email: r.email,
          message: r.message,
          question: r.question,
          createdAt: r.created_at,
        };
      });
  }
}
