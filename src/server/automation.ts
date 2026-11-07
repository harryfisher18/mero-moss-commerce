import { AutomationService } from "@/server/automation-service";
import { getDatabase } from "@/server/db/client";

export function automationService(): AutomationService {
  return new AutomationService(getDatabase());
}

/**
 * Processes due outbox events in this server process. Called with `after()` once a
 * response is sent, so checkout never waits on automation. The outbox stays the source of
 * truth: if this run is skipped or crashes, the standalone worker (`npm run worker`) or the
 * merchant console's "Run due jobs" picks the events up later.
 */
export function drainOutbox(): void {
  try {
    const summary = automationService().runDue();
    if (summary.processed > 0) {
      console.info(
        `[automation] processed ${summary.processed} event(s): ${summary.succeeded} succeeded, ${summary.retrying} retrying, ${summary.dead} dead-lettered`,
      );
    }
  } catch (error) {
    // Log the message only: payloads can contain personal data.
    console.error(
      `[automation] worker run failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}
