import { z } from "zod";
import {
  CONSENT_SOURCES,
  type ConsentSource,
  JOURNEY_IDS,
  type JourneyId,
} from "@/domain/lifecycle/journeys";
import type { Database } from "@/server/db/database";

export const MESSAGE_STATUSES = ["previewed", "skipped_no_consent", "skipped_empty"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export interface NewLifecycleRecord {
  readonly journey: JourneyId;
  readonly dedupeKey: string;
  /** Null for skipped journeys, so nothing is kept about people who did not opt in. */
  readonly email: string | null;
  readonly reference: string;
  readonly status: MessageStatus;
  readonly subject: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface LifecycleRecord extends NewLifecycleRecord {
  readonly id: number;
}

export interface ConsentRecord {
  readonly email: string;
  readonly status: "granted" | "withdrawn";
  readonly source: ConsentSource;
  readonly grantedAt: string;
  readonly withdrawnAt: string | null;
}

export interface AbandonedCandidate {
  readonly cartId: string;
  readonly email: string;
  readonly updatedAt: string;
}

const consentRow = z.object({
  email: z.string(),
  status: z.enum(["granted", "withdrawn"]),
  source: z.enum(CONSENT_SOURCES),
  granted_at: z.string(),
  withdrawn_at: z.string().nullable(),
});
const messageRow = z.object({
  id: z.number().int(),
  journey: z.enum(JOURNEY_IDS),
  dedupe_key: z.string(),
  email: z.string().nullable(),
  reference: z.string(),
  status: z.enum(MESSAGE_STATUSES),
  subject: z.string(),
  body: z.string(),
  created_at: z.string(),
});
const candidateRow = z.object({ cart_id: z.string(), email: z.string(), updated_at: z.string() });

export class SqliteLifecycleRepository {
  constructor(private readonly db: Database) {}

  grantConsent(email: string, source: ConsentSource, at: string): void {
    this.db
      .prepare(
        `INSERT INTO marketing_consents (email, status, source, granted_at)
         VALUES (?, 'granted', ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           status = 'granted', source = excluded.source,
           granted_at = excluded.granted_at, withdrawn_at = NULL`,
      )
      .run(email, source, at);
  }

  withdrawConsent(email: string, at: string): boolean {
    return (
      Number(
        this.db
          .prepare(
            "UPDATE marketing_consents SET status = 'withdrawn', withdrawn_at = ? WHERE email = ? AND status = 'granted'",
          )
          .run(at, email).changes,
      ) > 0
    );
  }

  hasConsent(email: string): boolean {
    return (
      this.db
        .prepare("SELECT 1 FROM marketing_consents WHERE email = ? AND status = 'granted'")
        .get(email) !== undefined
    );
  }

  consents(limit = 100): ConsentRecord[] {
    return this.db
      .prepare(
        "SELECT email, status, source, granted_at, withdrawn_at FROM marketing_consents ORDER BY granted_at DESC LIMIT ?",
      )
      .all(limit)
      .map((raw) => {
        const row = consentRow.parse(raw);
        return {
          email: row.email,
          status: row.status,
          source: row.source,
          grantedAt: row.granted_at,
          withdrawnAt: row.withdrawn_at,
        };
      });
  }

  linkCart(cartId: string, email: string, at: string): void {
    this.db
      .prepare(
        `INSERT INTO cart_contacts (cart_id, email, created_at) VALUES (?, ?, ?)
         ON CONFLICT(cart_id) DO UPDATE SET email = excluded.email`,
      )
      .run(cartId, email, at);
  }

  abandonedCandidates(cutoff: string, limit = 100): AbandonedCandidate[] {
    return this.db
      .prepare(
        `SELECT cc.cart_id, cc.email, c.updated_at FROM cart_contacts cc
         JOIN carts c ON c.id = cc.cart_id
         WHERE c.updated_at <= ? ORDER BY c.updated_at LIMIT ?`,
      )
      .all(cutoff, limit)
      .map((raw) => {
        const row = candidateRow.parse(raw);
        return { cartId: row.cart_id, email: row.email, updatedAt: row.updated_at };
      });
  }

  hasRecord(dedupeKey: string): boolean {
    return (
      this.db.prepare("SELECT 1 FROM lifecycle_messages WHERE dedupe_key = ?").get(dedupeKey) !==
      undefined
    );
  }

  /** Returns 1 when added, 0 when this dedupe key already exists. */
  addRecord(record: NewLifecycleRecord): number {
    return Number(
      this.db
        .prepare(
          `INSERT OR IGNORE INTO lifecycle_messages
             (journey, dedupe_key, email, reference, status, subject, body, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          record.journey,
          record.dedupeKey,
          record.email,
          record.reference,
          record.status,
          record.subject,
          record.body,
          record.createdAt,
        ).changes,
    );
  }

  records(limit = 50): LifecycleRecord[] {
    return this.db
      .prepare(
        `SELECT id, journey, dedupe_key, email, reference, status, subject, body, created_at
         FROM lifecycle_messages ORDER BY id DESC LIMIT ?`,
      )
      .all(limit)
      .map((raw) => {
        const row = messageRow.parse(raw);
        return {
          id: row.id,
          journey: row.journey,
          dedupeKey: row.dedupe_key,
          email: row.email,
          reference: row.reference,
          status: row.status,
          subject: row.subject,
          body: row.body,
          createdAt: row.created_at,
        };
      });
  }

  countsByJourney(): Record<JourneyId, Record<MessageStatus, number>> {
    const empty = () => ({ previewed: 0, skipped_no_consent: 0, skipped_empty: 0 });
    const counts = { welcome: empty(), abandoned_cart: empty(), post_purchase: empty() };
    const rows = this.db
      .prepare(
        "SELECT journey, status, COUNT(*) AS n FROM lifecycle_messages GROUP BY journey, status",
      )
      .all();
    for (const raw of rows) {
      const row = z
        .object({
          journey: z.enum(JOURNEY_IDS),
          status: z.enum(MESSAGE_STATUSES),
          n: z.number().int(),
        })
        .parse(raw);
      counts[row.journey][row.status] = row.n;
    }
    return counts;
  }
}
