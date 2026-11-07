import { z } from "zod";
import {
  ATTEMPT_OUTCOMES,
  ATTEMPT_TRIGGERS,
  type AttemptOutcome,
  type AttemptTrigger,
  EVENT_STATUSES,
  EVENT_TYPES,
  type EventFilter,
  type EventStatus,
  type EventType,
} from "@/domain/events/outbox";
import { NOTIFICATION_KINDS, type NotificationPreview } from "@/domain/events/order-created";
import type { Database } from "@/server/db/database";

export interface OutboxEvent {
  readonly id: string;
  readonly type: EventType;
  readonly aggregateId: string;
  readonly subject: string;
  /** Parsed JSON. Handlers validate it with their own schema before use. */
  readonly payload: unknown;
  readonly status: EventStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly nextAttemptAt: string;
  readonly lastError: string | null;
  readonly createdAt: string;
  readonly processedAt: string | null;
}

export interface NewOutboxEvent {
  readonly id: string;
  readonly type: EventType;
  readonly aggregateId: string;
  readonly subject: string;
  readonly payload: unknown;
  readonly maxAttempts: number;
  readonly createdAt: string;
}

export interface JobAttempt {
  readonly trigger: AttemptTrigger;
  readonly outcome: AttemptOutcome;
  readonly detail: string;
  readonly createdAt: string;
}

export interface StoredPreview extends NotificationPreview {
  readonly createdAt: string;
}

export interface OrderTagRow {
  readonly tag: string;
  readonly sourceEventId: string;
}

const eventRow = z.object({
  id: z.string(),
  type: z.enum(EVENT_TYPES),
  aggregate_id: z.string(),
  subject: z.string(),
  payload: z.string(),
  status: z.enum(EVENT_STATUSES),
  attempts: z.number().int(),
  max_attempts: z.number().int(),
  next_attempt_at: z.string(),
  last_error: z.string().nullable(),
  created_at: z.string(),
  processed_at: z.string().nullable(),
});

const attemptRow = z.object({
  trigger: z.enum(ATTEMPT_TRIGGERS),
  outcome: z.enum(ATTEMPT_OUTCOMES),
  detail: z.string(),
  created_at: z.string(),
});

const previewRow = z.object({
  kind: z.enum(NOTIFICATION_KINDS),
  recipient: z.string(),
  subject: z.string(),
  body: z.string(),
  created_at: z.string(),
});

const countRow = z.object({ n: z.number().int() });

function toEvent(raw: unknown): OutboxEvent {
  const row = eventRow.parse(raw);
  return {
    id: row.id,
    type: row.type,
    aggregateId: row.aggregate_id,
    subject: row.subject,
    payload: JSON.parse(row.payload) as unknown,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    processedAt: row.processed_at,
  };
}

const FILTER_SQL: Record<EventFilter, string> = {
  all: "1 = 1",
  queued: "status = 'pending' AND attempts = 0",
  retrying: "status = 'pending' AND attempts > 0",
  succeeded: "status = 'succeeded'",
  dead: "status = 'dead'",
};

const EVENT_COLUMNS = `id, type, aggregate_id, subject, payload, status, attempts, max_attempts,
  next_attempt_at, last_error, created_at, processed_at`;

/** Persistence for the outbox, its attempt log and the effects it produces. */
export class SqliteAutomationRepository {
  constructor(private readonly db: Database) {}

  enqueue(event: NewOutboxEvent): void {
    this.db
      .prepare(
        `INSERT INTO outbox_events
           (id, type, aggregate_id, subject, payload, max_attempts, next_attempt_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.type,
        event.aggregateId,
        event.subject,
        JSON.stringify(event.payload),
        event.maxAttempts,
        event.createdAt,
        event.createdAt,
      );
  }

  get(id: string): OutboxEvent | null {
    const raw = this.db.prepare(`SELECT ${EVENT_COLUMNS} FROM outbox_events WHERE id = ?`).get(id);
    return raw ? toEvent(raw) : null;
  }

  list(filter: EventFilter, limit: number): OutboxEvent[] {
    return this.db
      .prepare(
        `SELECT ${EVENT_COLUMNS} FROM outbox_events WHERE ${FILTER_SQL[filter]}
         ORDER BY created_at DESC, rowid DESC LIMIT ?`,
      )
      .all(limit)
      .map(toEvent);
  }

  forAggregate(aggregateId: string): OutboxEvent[] {
    return this.db
      .prepare(
        `SELECT ${EVENT_COLUMNS} FROM outbox_events WHERE aggregate_id = ? ORDER BY created_at, rowid`,
      )
      .all(aggregateId)
      .map(toEvent);
  }

  count(filter: EventFilter): number {
    return countRow.parse(
      this.db.prepare(`SELECT COUNT(*) AS n FROM outbox_events WHERE ${FILTER_SQL[filter]}`).get(),
    ).n;
  }

  /** Ids of pending events whose next attempt is due, oldest first. */
  dueIds(now: string, limit: number): string[] {
    return this.db
      .prepare(
        `SELECT id FROM outbox_events WHERE status = 'pending' AND next_attempt_at <= ?
         ORDER BY next_attempt_at, rowid LIMIT ?`,
      )
      .all(now, limit)
      .map((row) => z.object({ id: z.string() }).parse(row).id);
  }

  markSucceeded(id: string, attempts: number, at: string): void {
    this.db
      .prepare(
        `UPDATE outbox_events SET status = 'succeeded', attempts = ?, last_error = NULL,
           processed_at = ? WHERE id = ?`,
      )
      .run(attempts, at, id);
  }

  markRetry(id: string, attempts: number, nextAttemptAt: string, error: string): void {
    this.db
      .prepare(
        `UPDATE outbox_events SET status = 'pending', attempts = ?, next_attempt_at = ?,
           last_error = ? WHERE id = ?`,
      )
      .run(attempts, nextAttemptAt, error, id);
  }

  markDead(id: string, attempts: number, error: string, at: string): void {
    this.db
      .prepare(
        `UPDATE outbox_events SET status = 'dead', attempts = ?, last_error = ?, processed_at = ?
         WHERE id = ?`,
      )
      .run(attempts, error, at, id);
  }

  addAttempt(eventId: string, attempt: JobAttempt): void {
    this.db
      .prepare(
        "INSERT INTO job_attempts (event_id, trigger, outcome, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(eventId, attempt.trigger, attempt.outcome, attempt.detail, attempt.createdAt);
  }

  attempts(eventId: string): JobAttempt[] {
    return this.db
      .prepare(
        "SELECT trigger, outcome, detail, created_at FROM job_attempts WHERE event_id = ? ORDER BY id",
      )
      .all(eventId)
      .map((raw) => {
        const row = attemptRow.parse(raw);
        return {
          trigger: row.trigger,
          outcome: row.outcome,
          detail: row.detail,
          createdAt: row.created_at,
        };
      });
  }

  /** Returns 1 when the tag was added, 0 when this order already had it. */
  addTag(orderId: string, tag: string, eventId: string, at: string): number {
    return Number(
      this.db
        .prepare(
          "INSERT OR IGNORE INTO order_tags (order_id, tag, source_event_id, created_at) VALUES (?, ?, ?, ?)",
        )
        .run(orderId, tag, eventId, at).changes,
    );
  }

  tagsForOrder(orderId: string): OrderTagRow[] {
    return this.db
      .prepare("SELECT tag, source_event_id FROM order_tags WHERE order_id = ? ORDER BY tag")
      .all(orderId)
      .map((raw) => {
        const row = z.object({ tag: z.string(), source_event_id: z.string() }).parse(raw);
        return { tag: row.tag, sourceEventId: row.source_event_id };
      });
  }

  /** Returns 1 when recorded, 0 when this event already recorded a preview of this kind. */
  addPreview(eventId: string, preview: NotificationPreview, at: string): number {
    return Number(
      this.db
        .prepare(
          `INSERT OR IGNORE INTO notification_previews
             (event_id, kind, recipient, subject, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(eventId, preview.kind, preview.recipient, preview.subject, preview.body, at).changes,
    );
  }

  previews(eventId: string): StoredPreview[] {
    return this.db
      .prepare(
        `SELECT kind, recipient, subject, body, created_at FROM notification_previews
         WHERE event_id = ? ORDER BY id`,
      )
      .all(eventId)
      .map((raw) => {
        const row = previewRow.parse(raw);
        return {
          kind: row.kind,
          recipient: row.recipient,
          subject: row.subject,
          body: row.body,
          createdAt: row.created_at,
        };
      });
  }
}
