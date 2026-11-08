import { z } from "zod";
import {
  computeFunnel,
  FUNNEL_STEPS,
  type Funnel,
  type FunnelStep,
} from "@/domain/analytics/funnel";
import {
  type CurrencyCode,
  money,
  type Money,
  SUPPORTED_CURRENCIES,
} from "@/domain/commerce/money";
import type { Database } from "@/server/db/database";

/** What one event may store. There is deliberately no field for personal data. */
export interface AnalyticsEventInput {
  readonly name: FunnelStep;
  readonly productId?: string;
  readonly quantity?: number;
  readonly value?: Money;
}

export interface AnalyticsReport {
  readonly funnel: Funnel;
  readonly eventCount: number;
  /** True when only the most recent events were used. */
  readonly truncated: boolean;
  readonly firstEventAt: string | null;
  readonly lastEventAt: string | null;
  readonly simulatedOrderValue: readonly Money[];
}

/** Upper bound on events read for one report. */
export const REPORT_EVENT_LIMIT = 50_000;

const eventRow = z.object({
  session_id: z.string(),
  name: z.enum(FUNNEL_STEPS),
  created_at: z.string(),
});
const valueRow = z.object({ currency: z.enum(SUPPORTED_CURRENCIES), total: z.number().int() });

export class AnalyticsService {
  constructor(
    private readonly db: Database,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  record(sessionId: string, event: AnalyticsEventInput): void {
    this.db
      .prepare(
        `INSERT INTO analytics_events
           (session_id, name, product_id, quantity, value_minor, currency, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        sessionId,
        event.name,
        event.productId ?? null,
        event.quantity ?? null,
        event.value?.amountMinor ?? null,
        (event.value?.currency ?? null) as CurrencyCode | null,
        this.now(),
      );
  }

  report(limit = REPORT_EVENT_LIMIT): AnalyticsReport {
    const rows = this.db
      .prepare(`SELECT session_id, name, created_at FROM analytics_events ORDER BY id DESC LIMIT ?`)
      .all(limit + 1)
      .map((raw) => eventRow.parse(raw));
    const truncated = rows.length > limit;
    const oldestFirst = rows.slice(0, limit).reverse();
    return {
      funnel: computeFunnel(
        oldestFirst.map((row) => ({ sessionId: row.session_id, name: row.name })),
      ),
      eventCount: oldestFirst.length,
      truncated,
      firstEventAt: oldestFirst[0]?.created_at ?? null,
      lastEventAt: oldestFirst.at(-1)?.created_at ?? null,
      simulatedOrderValue: this.db
        .prepare(
          `SELECT currency, SUM(value_minor) AS total FROM analytics_events
           WHERE name = 'purchase' AND currency IS NOT NULL GROUP BY currency ORDER BY currency`,
        )
        .all()
        .map((raw) => {
          const row = valueRow.parse(raw);
          return money(row.total, row.currency);
        }),
    };
  }
}
