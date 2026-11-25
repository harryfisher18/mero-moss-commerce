import { z } from "zod";
import { type Database, withTransaction } from "@/server/db/database";
import { insertSeedData } from "@/server/db/seed";

/**
 * Tables kept by a reset: the migration record, merchant sessions so the merchant who
 * reset the store stays signed in, and the reset history itself.
 */
const KEEP = new Set(["schema_migrations", "merchant_sessions", "sqlite_sequence", "demo_resets"]);

export interface ResetSummary {
  readonly tablesCleared: number;
  readonly rowsRemoved: number;
}

export interface DemoResetRecord extends ResetSummary {
  readonly actor: string;
  readonly createdAt: string;
}

/**
 * Restores the demo store to its seeded state in one transaction: every order, cart,
 * event, request and edit is removed and the demo catalog is inserted again. The reset is
 * recorded, with who ran it and how much it removed, in the same transaction. Callers must
 * have checked that the public demo login is active (see checkDemoReset).
 */
export function resetDemoStore(
  db: Database,
  by: { readonly actor: string; readonly at: string },
): ResetSummary {
  return withTransaction(db, () => {
    // Foreign keys are checked at commit, when every table is consistent again.
    db.exec("PRAGMA defer_foreign_keys = ON");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => z.object({ name: z.string() }).parse(row).name)
      .filter((name) => !KEEP.has(name));
    let rowsRemoved = 0;
    for (const table of tables) {
      // Table names come from sqlite_master, never from input.
      rowsRemoved += Number(db.prepare(`DELETE FROM "${table}"`).run().changes);
    }
    db.prepare(
      `DELETE FROM sqlite_sequence WHERE name IN (${tables.map(() => "?").join(", ")})`,
    ).run(...tables);
    insertSeedData(db);
    db.prepare(
      "INSERT INTO demo_resets (actor, tables_cleared, rows_removed, created_at) VALUES (?, ?, ?, ?)",
    ).run(by.actor, tables.length, rowsRemoved, by.at);
    return { tablesCleared: tables.length, rowsRemoved };
  });
}

const resetRow = z.object({
  actor: z.string(),
  tables_cleared: z.number().int(),
  rows_removed: z.number().int(),
  created_at: z.string(),
});

/** The most recent demo resets, newest first. */
export function recentDemoResets(db: Database, limit = 10): DemoResetRecord[] {
  return db
    .prepare(
      `SELECT actor, tables_cleared, rows_removed, created_at FROM demo_resets
       ORDER BY id DESC LIMIT ?`,
    )
    .all(limit)
    .map((raw) => {
      const row = resetRow.parse(raw);
      return {
        actor: row.actor,
        tablesCleared: row.tables_cleared,
        rowsRemoved: row.rows_removed,
        createdAt: row.created_at,
      };
    });
}
