import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { openDatabase } from "@/server/db/database";
import { MIGRATIONS } from "@/server/db/migrations";
import { seedDatabase } from "@/server/db/seed";

const WORKER = resolve("tests/unit/concurrent-open-worker.ts");
const PROCESSES = 8;
const ROUNDS = 3;

interface WorkerResult {
  readonly code: number | null;
  readonly stderr: string;
}

/** Starts one worker; `ready` settles when it is waiting at the barrier. */
function startWorker(dbPath: string, goFile: string) {
  const child = spawn(process.execPath, ["--import", "tsx", WORKER, goFile], {
    env: { ...process.env, MERO_MOSS_DB_PATH: dbPath },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const finished = new Promise<WorkerResult>((done) => {
    child.on("close", (code) => done({ code, stderr }));
  });
  const ready = new Promise<void>((done) => {
    child.stdout.once("data", () => done());
    void finished.then(() => done());
  });
  return { ready, finished };
}

const count = (db: DatabaseSync, table: string) =>
  Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n);

describe("first open of a new database", () => {
  it("survives many processes opening and seeding it at the same moment", async () => {
    const seeded = openDatabase(":memory:");
    seedDatabase(seeded);
    const expected = { products: count(seeded, "products"), variants: count(seeded, "variants") };
    seeded.close();

    for (let round = 0; round < ROUNDS; round += 1) {
      const dir = mkdtempSync(join(tmpdir(), "mero-moss-open-"));
      try {
        const dbPath = join(dir, "shop.db");
        const goFile = join(dir, "go");
        const workers = Array.from({ length: PROCESSES }, () => startWorker(dbPath, goFile));
        await Promise.all(workers.map((worker) => worker.ready));
        writeFileSync(goFile, "");

        const results = await Promise.all(workers.map((worker) => worker.finished));
        expect(results.filter((result) => result.code !== 0)).toEqual([]);

        const db = new DatabaseSync(dbPath);
        expect(
          db
            .prepare("SELECT version FROM schema_migrations ORDER BY version")
            .all()
            .map((row) => row.version),
        ).toEqual(MIGRATIONS.map((migration) => migration.version).sort((a, b) => a - b));
        expect({
          products: count(db, "products"),
          variants: count(db, "variants"),
        }).toEqual(expected);
        db.close();
      } finally {
        rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    }
  }, 120_000);
});
