import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS, type Migration } from "./migrations";

export type Database = DatabaseSync;

export const DEFAULT_DB_PATH = ".data/mero-moss.db";

export function resolveDbPath(env: NodeJS.ProcessEnv = process.env): string {
  // The database is runtime data, not a code dependency, so exclude it from output file tracing.
  return resolve(/*turbopackIgnore: true*/ process.cwd(), env.MERO_MOSS_DB_PATH || DEFAULT_DB_PATH);
}

const WAL_RETRY_MS = 5000;
const WAL_RETRY_PAUSE_MS = 25;
const SQLITE_BUSY = 5;
const SQLITE_LOCKED = 6;

function isLockError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("errcode" in error)) return false;
  // Extended result codes keep the primary code in the low byte.
  const code = Number(error.errcode) & 0xff;
  return code === SQLITE_BUSY || code === SQLITE_LOCKED;
}

/**
 * Switching to WAL needs an exclusive lock, and SQLite can report a conflict without using
 * the busy timeout, so processes opening a new database together retry here. Opening is
 * synchronous, so the pause blocks this thread for its short duration.
 */
function enableWal(db: Database): void {
  const deadline = Date.now() + WAL_RETRY_MS;
  for (;;) {
    try {
      db.exec("PRAGMA journal_mode = WAL;");
      return;
    } catch (error) {
      if (!isLockError(error) || Date.now() >= deadline) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, WAL_RETRY_PAUSE_MS);
    }
  }
}

/** Opens (and creates if needed) a database and applies pending migrations. */
export function openDatabase(path: string): Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  if (path !== ":memory:") {
    // Set first: several processes may open a new database at once (e.g. build workers).
    db.exec("PRAGMA busy_timeout = 5000;");
    enableWal(db);
  }
  migrate(db);
  return db;
}

export function migrate(db: Database, migrations: readonly Migration[] = MIGRATIONS): number[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    db
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row) => Number(row.version)),
  );
  const newlyApplied: number[] = [];
  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (applied.has(migration.version)) continue;
    const ranHere = withTransaction(db, () => {
      // Check again now that the write lock is held: another process may have got here first.
      const done = db
        .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
        .get(migration.version);
      if (done) return false;
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)").run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
      return true;
    });
    if (ranHere) newlyApplied.push(migration.version);
  }
  return newlyApplied;
}

/** Runs `fn` inside a transaction, rolling back on any thrown error. */
export function withTransaction<T>(db: Database, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
