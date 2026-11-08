/**
 * Standalone order-automation worker. Polls the outbox in the configured database and
 * processes due events, including scheduled retries.
 *
 *   npm run worker            # poll every 2 seconds until Ctrl+C
 *   npm run worker -- --once  # process what is due now and exit
 *
 * It only records tags and notification previews. It never sends messages or calls
 * external services.
 */
import { AutomationService } from "../src/server/automation-service";
import { openDatabase, resolveDbPath } from "../src/server/db/database";
import { LifecycleService } from "../src/server/lifecycle-service";

const POLL_INTERVAL_MS = 2_000;

const db = openDatabase(resolveDbPath());
const worker = new AutomationService(db);
const lifecycle = new LifecycleService(db);

function tick(): void {
  lifecycle.sweepAbandonedCarts();
  const summary = worker.runDue();
  if (summary.processed > 0) {
    console.log(
      `${new Date().toISOString()} processed ${summary.processed}: ${summary.succeeded} succeeded, ${summary.retrying} retrying, ${summary.dead} dead-lettered`,
    );
  }
}

if (process.argv.includes("--once")) {
  tick();
  db.close();
} else {
  console.log(`Automation worker polling ${resolveDbPath()} every ${POLL_INTERVAL_MS / 1000} s.`);
  tick();
  const timer = setInterval(tick, POLL_INTERVAL_MS);
  const stop = () => {
    clearInterval(timer);
    db.close();
    console.log("Automation worker stopped.");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
