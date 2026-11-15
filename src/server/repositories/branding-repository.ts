import { z } from "zod";
import {
  type Branding,
  type BrandingChange,
  DEFAULT_BRANDING,
  diffBranding,
} from "@/domain/merchant/branding";
import { type Database, withTransaction } from "@/server/db/database";

export interface RecordedBrandingChange extends BrandingChange {
  readonly actor: string;
  readonly createdAt: string;
}

const brandingRow = z.object({ tagline: z.string(), announcement: z.string() });
const changeRow = z.object({
  field: z.enum(["tagline", "announcement"]),
  before: z.string(),
  after: z.string(),
  actor: z.string(),
  created_at: z.string(),
});

/**
 * Storefront branding. Without a saved row the seeded defaults apply, so a demo reset,
 * which clears the table, returns the storefront to its original wording.
 */
export class SqliteBrandingRepository {
  constructor(private readonly db: Database) {}

  get(): Branding {
    const row = this.db
      .prepare("SELECT tagline, announcement FROM store_branding WHERE id = 1")
      .get();
    return row ? brandingRow.parse(row) : DEFAULT_BRANDING;
  }

  /** Saves validated branding and records one change row per changed field. */
  save(next: Branding, actor: string, now: string): BrandingChange[] {
    return withTransaction(this.db, () => {
      const changes = diffBranding(this.get(), next);
      if (changes.length === 0) return changes;
      this.db
        .prepare(
          `INSERT INTO store_branding (id, tagline, announcement, updated_at) VALUES (1, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET tagline = excluded.tagline,
             announcement = excluded.announcement, updated_at = excluded.updated_at`,
        )
        .run(next.tagline, next.announcement, now);
      const insert = this.db.prepare(
        "INSERT INTO branding_changes (field, before, after, actor, created_at) VALUES (?, ?, ?, ?, ?)",
      );
      for (const change of changes) {
        insert.run(change.field, change.before, change.after, actor, now);
      }
      return changes;
    });
  }

  history(limit = 20): RecordedBrandingChange[] {
    return this.db
      .prepare(
        `SELECT field, before, after, actor, created_at FROM branding_changes
         ORDER BY id DESC LIMIT ?`,
      )
      .all(limit)
      .map((raw) => {
        const row = changeRow.parse(raw);
        return {
          field: row.field,
          before: row.before,
          after: row.after,
          actor: row.actor,
          createdAt: row.created_at,
        };
      });
  }
}
