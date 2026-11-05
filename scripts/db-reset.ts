/**
 * Recreates the LOCAL demo database from seed data.
 * Refuses to run against anything other than a local SQLite file path.
 */
import { existsSync, rmSync } from "node:fs";
import { openDatabase, resolveDbPath } from "../src/server/db/database";
import { seedDatabase } from "../src/server/db/seed";

const path = resolveDbPath();
if (/^[a-z]+:\/\//i.test(process.env.MERO_MOSS_DB_PATH ?? "")) {
  console.error("db:reset only operates on local SQLite files.");
  process.exit(1);
}

for (const suffix of ["", "-wal", "-shm"]) {
  if (existsSync(path + suffix)) rmSync(path + suffix);
}

const db = openDatabase(path);
seedDatabase(db);
const products = db.prepare("SELECT COUNT(*) AS count FROM products").get();
const variants = db.prepare("SELECT COUNT(*) AS count FROM variants").get();
db.close();

console.log(
  `Demo database recreated at ${path} (${String(products?.count)} products, ${String(variants?.count)} variants).`,
);
