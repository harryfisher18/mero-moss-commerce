import { type Database, openDatabase, resolveDbPath } from "./database";
import { isSeeded, seedDatabase } from "./seed";

declare global {
  var __meroMossDb: Database | undefined;
}

/**
 * Process-wide database handle. Cached on globalThis so dev hot reloads reuse it.
 * An empty database is seeded with the synthetic demo catalog on first open.
 */
export function getDatabase(): Database {
  if (!globalThis.__meroMossDb) {
    const db = openDatabase(resolveDbPath());
    if (!isSeeded(db)) seedDatabase(db);
    globalThis.__meroMossDb = db;
  }
  return globalThis.__meroMossDb;
}
