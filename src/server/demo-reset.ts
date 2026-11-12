import { z } from "zod";
import { type Database, withTransaction } from "@/server/db/database";
import { insertSeedData } from "@/server/db/seed";

/**
 * Tables kept by a reset: the migration record, and merchant sessions so the merchant who
 * reset the store stays signed in.
 */
const KEEP = new Set(["schema_migrations", "merchant_sessions", "sqlite_sequence"]);

export interface ResetSummary {
  readonly tablesCleared: number;
  readonly rowsRemoved: number;
}

/**
 * Restores the demo store to its seeded state in one transaction: every order, cart,
 * event, request and edit is removed and the demo catalog is inserted again. Callers must
 * have checked that the public demo login is active (see checkDemoReset).
 */
export function resetDemoStore(db: Database): ResetSummary {
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
    return { tablesCleared: tables.length, rowsRemoved };
  });
}
