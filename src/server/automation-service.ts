import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  type AttemptOutcome,
  type AttemptTrigger,
  DRILL_FAILURE_MESSAGE,
  DRILL_SCENARIOS,
  type DrillScenario,
  drillPayloadSchema,
  drillShouldFail,
  type EventFilter,
  EVENT_FILTERS,
  PermanentEventError,
} from "@/domain/events/outbox";
import {
  notificationPreviews,
  orderCreatedPayloadSchema,
  routeOrder,
} from "@/domain/events/order-created";
import { planAfterFailure, RETRY_POLICY, type RetryPolicy } from "@/domain/events/retry-policy";
import { type Database, withTransaction } from "@/server/db/database";
import { LifecycleService } from "@/server/lifecycle-service";
import {
  type JobAttempt,
  type OrderTagRow,
  type OutboxEvent,
  SqliteAutomationRepository,
  type StoredPreview,
} from "@/server/repositories/automation-repository";

export type ProcessResult =
  | {
      readonly ok: true;
      readonly outcome: AttemptOutcome;
      readonly effects: number;
      readonly attempts: number;
      /** Set when a retry was scheduled. */
      readonly delayMs: number | null;
      readonly error: string | null;
    }
  | { readonly ok: false; readonly reason: "not_found" | "not_due" | "not_allowed" };

export interface RunSummary {
  readonly processed: number;
  readonly succeeded: number;
  readonly retrying: number;
  readonly dead: number;
}

export interface EventDetail {
  readonly event: OutboxEvent;
  readonly attempts: JobAttempt[];
  readonly previews: StoredPreview[];
  readonly tags: OrderTagRow[];
}

const MAX_ERROR_LENGTH = 500;

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message.slice(0, MAX_ERROR_LENGTH);
}

/**
 * The order-automation worker and its read model.
 *
 * Each attempt runs in ONE write transaction: re-check the event is still eligible, run the
 * handler inside a savepoint, then record the outcome. Handler effects (order tags and
 * notification previews) are keyed by event id with unique constraints, so a replay or a
 * second worker can never apply them twice. A failure rolls the savepoint back, so a
 * failed attempt leaves no partial effects, and schedules the next try with bounded
 * exponential backoff until the event is dead-lettered.
 *
 * Nothing here sends messages or calls external services: notifications are previews.
 */
export class AutomationService {
  private readonly repo: SqliteAutomationRepository;

  constructor(
    private readonly db: Database,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = randomUUID,
    private readonly policy: RetryPolicy = RETRY_POLICY,
    private readonly lifecycle: LifecycleService = new LifecycleService(db),
  ) {
    this.repo = new SqliteAutomationRepository(db);
  }

  /** Processes every event that is due now, oldest first. */
  runDue(limit = 25): RunSummary {
    const summary = { processed: 0, succeeded: 0, retrying: 0, dead: 0 };
    for (const id of this.repo.dueIds(this.now().toISOString(), limit)) {
      const result = this.attempt(id, "worker");
      if (!result.ok) continue; // Another worker got there first.
      summary.processed += 1;
      if (result.outcome === "succeeded" || result.outcome === "duplicate") summary.succeeded += 1;
      else if (result.outcome === "failed") summary.retrying += 1;
      else summary.dead += 1;
    }
    return summary;
  }

  /** Operator action: attempt a pending or dead-lettered event immediately. */
  retryNow(eventId: string): ProcessResult {
    return this.attempt(eventId, "retry_now");
  }

  /** Operator action: re-run a succeeded event's handler. Effects are not duplicated. */
  replay(eventId: string): ProcessResult {
    return this.attempt(eventId, "replay");
  }

  /** Enqueues a labelled failure drill and makes its first attempt. Returns the event id. */
  startDrill(scenario: DrillScenario): string {
    const id = this.newId();
    withTransaction(this.db, () => {
      this.repo.enqueue({
        id,
        type: "automation.drill",
        aggregateId: "drill",
        subject: DRILL_SCENARIOS[scenario].subject,
        payload: { scenario },
        maxAttempts: this.policy.maxAttempts,
        createdAt: this.now().toISOString(),
      });
    });
    this.attempt(id, "worker");
    return id;
  }

  list(filter: EventFilter, limit = 50): OutboxEvent[] {
    return this.repo.list(filter, limit);
  }

  counts(): Record<EventFilter, number> {
    return Object.fromEntries(
      EVENT_FILTERS.map((filter) => [filter, this.repo.count(filter)]),
    ) as Record<EventFilter, number>;
  }

  detail(eventId: string): EventDetail | null {
    const event = this.repo.get(eventId);
    if (!event) return null;
    return {
      event,
      attempts: this.repo.attempts(eventId),
      previews: this.repo.previews(eventId),
      tags: event.type === "order.created" ? this.repo.tagsForOrder(event.aggregateId) : [],
    };
  }

  forOrder(orderId: string): { events: OutboxEvent[]; tags: OrderTagRow[] } {
    return { events: this.repo.forAggregate(orderId), tags: this.repo.tagsForOrder(orderId) };
  }

  private attempt(eventId: string, trigger: AttemptTrigger): ProcessResult {
    return withTransaction(this.db, (): ProcessResult => {
      const now = this.now();
      const at = now.toISOString();
      const event = this.repo.get(eventId);
      if (!event) return { ok: false, reason: "not_found" };
      if (trigger === "worker" && (event.status !== "pending" || event.nextAttemptAt > at)) {
        return { ok: false, reason: "not_due" };
      }
      if (trigger === "retry_now" && event.status === "succeeded") {
        return { ok: false, reason: "not_allowed" };
      }
      if (
        trigger === "replay" &&
        (event.status !== "succeeded" || event.type !== "order.created")
      ) {
        return { ok: false, reason: "not_allowed" };
      }

      // Replays re-check effects; they are not delivery attempts and keep the counter.
      const attempts = trigger === "replay" ? event.attempts : event.attempts + 1;

      this.db.exec("SAVEPOINT handler");
      let effects: number;
      try {
        effects = this.handle(event, at);
        this.db.exec("RELEASE handler");
      } catch (error) {
        this.db.exec("ROLLBACK TO handler");
        this.db.exec("RELEASE handler");
        return this.recordFailure(event, trigger, attempts, error, now);
      }

      const outcome: AttemptOutcome =
        trigger === "replay" && effects === 0 ? "duplicate" : "succeeded";
      if (trigger !== "replay") this.repo.markSucceeded(event.id, attempts, at);
      this.repo.addAttempt(event.id, {
        trigger,
        outcome,
        detail:
          outcome === "duplicate"
            ? "Already applied. No new tags or previews were created."
            : effects === 0
              ? "Completed with no effects to apply."
              : `Applied ${effects} ${effects === 1 ? "effect" : "effects"} (tags and notification previews).`,
        createdAt: at,
      });
      return { ok: true, outcome, effects, attempts, delayMs: null, error: null };
    });
  }

  private recordFailure(
    event: OutboxEvent,
    trigger: AttemptTrigger,
    attempts: number,
    error: unknown,
    now: Date,
  ): ProcessResult {
    const at = now.toISOString();
    const message = errorMessage(error);
    if (trigger === "replay") {
      // The event already succeeded; a failed re-check is logged but changes nothing.
      this.repo.addAttempt(event.id, {
        trigger,
        outcome: "failed",
        detail: message,
        createdAt: at,
      });
      return { ok: true, outcome: "failed", effects: 0, attempts, delayMs: null, error: message };
    }
    const plan =
      event.status === "dead"
        ? ({ outcome: "dead" } as const) // A manual retry from the dead letter is a single try.
        : planAfterFailure(
            {
              attempts,
              maxAttempts: event.maxAttempts,
              permanent: error instanceof PermanentEventError,
            },
            now,
            this.policy,
          );
    if (plan.outcome === "retry") {
      this.repo.markRetry(event.id, attempts, plan.nextAttemptAt, message);
      this.repo.addAttempt(event.id, {
        trigger,
        outcome: "failed",
        detail: message,
        createdAt: at,
      });
      return {
        ok: true,
        outcome: "failed",
        effects: 0,
        attempts,
        delayMs: plan.delayMs,
        error: message,
      };
    }
    this.repo.markDead(event.id, attempts, message, at);
    this.repo.addAttempt(event.id, { trigger, outcome: "dead", detail: message, createdAt: at });
    return { ok: true, outcome: "dead", effects: 0, attempts, delayMs: null, error: message };
  }

  /** Applies the event's effects and returns how many were newly created. */
  private handle(event: OutboxEvent, at: string): number {
    switch (event.type) {
      case "order.created": {
        const parsed = orderCreatedPayloadSchema.safeParse(event.payload);
        if (!parsed.success) {
          throw new PermanentEventError(
            `Payload failed validation: ${z.prettifyError(parsed.error).replaceAll("\n", " ")}`,
          );
        }
        const payload = parsed.data;
        const routing = routeOrder(payload);
        let effects = 0;
        for (const tag of routing.tags) {
          effects += this.repo.addTag(payload.orderId, tag, event.id, at);
        }
        for (const preview of notificationPreviews(payload, routing)) {
          effects += this.repo.addPreview(event.id, preview, at);
        }
        return effects + this.lifecycle.onOrderCreated(event.id, payload, at);
      }
      case "automation.drill": {
        const parsed = drillPayloadSchema.safeParse(event.payload);
        if (!parsed.success) throw new PermanentEventError("Drill payload failed validation.");
        if (drillShouldFail(parsed.data.scenario, event.attempts)) {
          throw new Error(DRILL_FAILURE_MESSAGE);
        }
        return 0;
      }
    }
  }
}
