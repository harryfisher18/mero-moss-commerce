import { z } from "zod";

/**
 * First-party funnel events and the funnel calculation. Pure. Events carry an anonymous
 * browser-session id and catalog facts only: never a name, email, address, cart or order id.
 */

export const FUNNEL_STEPS = ["view_item", "add_to_cart", "begin_checkout", "purchase"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const FUNNEL_STEP_LABELS: Record<FunnelStep, string> = {
  view_item: "Viewed a product",
  add_to_cart: "Added to cart",
  begin_checkout: "Began checkout",
  purchase: "Placed a simulated order",
};

/** Holds only a random id. It lasts until the browser closes. */
export const ANALYTICS_COOKIE = "mm_sid";

export function analyticsCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: "lax", secure, path: "/" } as const;
}

/** Global Privacy Control: when the browser sends it, nothing is recorded or stored. */
export const honorsPrivacySignal = (secGpc: string | null) => secGpc === "1";

/** The only events a browser may report. The rest are recorded by the server itself. */
export const analyticsBeaconSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal("view_item"), productHandle: z.string().min(1).max(200) }),
  z.object({ name: z.literal("begin_checkout") }),
]);
export type AnalyticsBeacon = z.infer<typeof analyticsBeaconSchema>;

export interface RecordedEvent {
  readonly sessionId: string;
  readonly name: FunnelStep;
}

export interface FunnelRow {
  readonly step: FunnelStep;
  readonly label: string;
  readonly sessions: number;
  /** Share of the previous step, or null for the first step or an empty previous step. */
  readonly ofPrevious: number | null;
  readonly ofFirst: number | null;
  /** Sessions lost compared with the previous step. */
  readonly dropOff: number | null;
}

export interface Funnel {
  readonly rows: readonly FunnelRow[];
  readonly totalSessions: number;
}

/** A percentage with one decimal, or null when there is nothing to divide by. */
export function percent(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 1000) / 10;
}

/**
 * A session counts at a step only if it reached every earlier step first, in order.
 * `events` must be oldest first. Repeating a step never counts a session twice.
 */
export function computeFunnel(events: readonly RecordedEvent[]): Funnel {
  const reached = new Map<string, number>();
  for (const { sessionId, name } of events) {
    const next = reached.get(sessionId) ?? 0;
    reached.set(sessionId, FUNNEL_STEPS[next] === name ? next + 1 : next);
  }
  const depths = [...reached.values()];
  const counts = FUNNEL_STEPS.map((_, index) => depths.filter((depth) => depth > index).length);
  const first = counts[0] ?? 0;
  return {
    totalSessions: reached.size,
    rows: FUNNEL_STEPS.map((step, index) => {
      const sessions = counts[index] ?? 0;
      const previous = index === 0 ? null : (counts[index - 1] ?? 0);
      return {
        step,
        label: FUNNEL_STEP_LABELS[step],
        sessions,
        ofPrevious: previous === null ? null : percent(sessions, previous),
        ofFirst: index === 0 ? null : percent(sessions, first),
        dropOff: previous === null ? null : previous - sessions,
      };
    }),
  };
}
