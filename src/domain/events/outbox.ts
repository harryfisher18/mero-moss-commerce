import { z } from "zod";

/** Domain events written to the transactional outbox and processed by the worker. */
export const EVENT_TYPES = ["order.created", "automation.drill"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Stored lifecycle. A pending event with failed attempts is shown as "retry scheduled". */
export const EVENT_STATUSES = ["pending", "succeeded", "dead"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_FILTERS = ["all", "queued", "retrying", "succeeded", "dead"] as const;
export type EventFilter = (typeof EVENT_FILTERS)[number];
export type EventDisplayStatus = Exclude<EventFilter, "all">;

export function displayStatus(status: EventStatus, attempts: number): EventDisplayStatus {
  if (status === "pending") return attempts === 0 ? "queued" : "retrying";
  return status;
}

export const DISPLAY_STATUS_LABELS: Record<EventDisplayStatus, string> = {
  queued: "Queued",
  retrying: "Retry scheduled",
  succeeded: "Succeeded",
  dead: "Dead letter",
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  "order.created": "Order created",
  "automation.drill": "Failure drill (demo)",
};

/** What started an attempt. Replays and manual retries are operator actions. */
export const ATTEMPT_TRIGGERS = ["worker", "retry_now", "replay"] as const;
export type AttemptTrigger = (typeof ATTEMPT_TRIGGERS)[number];

export const ATTEMPT_OUTCOMES = ["succeeded", "duplicate", "failed", "dead"] as const;
export type AttemptOutcome = (typeof ATTEMPT_OUTCOMES)[number];

export const TRIGGER_LABELS: Record<AttemptTrigger, string> = {
  worker: "Worker",
  retry_now: "Retry now (merchant)",
  replay: "Replay (merchant)",
};

export const OUTCOME_LABELS: Record<AttemptOutcome, string> = {
  succeeded: "Succeeded",
  duplicate: "Already applied, no new effects",
  failed: "Failed, retry scheduled",
  dead: "Failed, moved to dead letter",
};

/** A failure that retrying cannot fix, such as a payload that fails validation. */
export class PermanentEventError extends Error {}

/**
 * Failure drills let a merchant watch retries and dead-lettering on demand. They are
 * labelled demo events with no side effects; the "failure" is injected by the handler.
 */
export const DRILL_SCENARIOS = {
  recovers: {
    subject: "Retry drill: fails twice, then recovers",
    failTimes: 2,
  },
  always_fails: {
    subject: "Dead-letter drill: always fails",
    failTimes: Number.POSITIVE_INFINITY,
  },
} as const;
export type DrillScenario = keyof typeof DRILL_SCENARIOS;

export const drillPayloadSchema = z.object({
  scenario: z.enum(Object.keys(DRILL_SCENARIOS) as [DrillScenario, ...DrillScenario[]]),
});

/** Whether a drill fails on the attempt after `attemptsSoFar` earlier attempts. */
export function drillShouldFail(scenario: DrillScenario, attemptsSoFar: number): boolean {
  return attemptsSoFar < DRILL_SCENARIOS[scenario].failTimes;
}

export const DRILL_FAILURE_MESSAGE =
  "Simulated failure (drill): the notification provider did not respond in time.";
