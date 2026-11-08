import { describe, expect, it } from "vitest";
import {
  analyticsBeaconSchema,
  computeFunnel,
  FUNNEL_STEPS,
  type FunnelStep,
  honorsPrivacySignal,
  percent,
  type RecordedEvent,
} from "./funnel";

const events = (sessionId: string, ...names: FunnelStep[]): RecordedEvent[] =>
  names.map((name) => ({ sessionId, name }));
const counts = (input: readonly RecordedEvent[]) =>
  computeFunnel(input).rows.map((row) => row.sessions);

describe("percent", () => {
  it("rounds to one decimal and never divides by zero", () => {
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(2, 2)).toBe(100);
    expect(percent(0, 4)).toBe(0);
    expect(percent(1, 0)).toBeNull();
  });
});

describe("computeFunnel", () => {
  it("is empty without events", () => {
    const funnel = computeFunnel([]);
    expect(funnel.totalSessions).toBe(0);
    expect(funnel.rows.map((row) => [row.sessions, row.ofPrevious, row.ofFirst])).toEqual([
      [0, null, null],
      [0, null, null],
      [0, null, null],
      [0, null, null],
    ]);
  });

  it("counts sessions per step with conversion and drop-off", () => {
    const funnel = computeFunnel([
      ...events("a", ...FUNNEL_STEPS),
      ...events("b", "view_item", "add_to_cart", "begin_checkout"),
      ...events("c", "view_item", "add_to_cart"),
      ...events("d", "view_item"),
    ]);
    expect(funnel.totalSessions).toBe(4);
    expect(funnel.rows).toEqual([
      expect.objectContaining({ step: "view_item", sessions: 4, ofPrevious: null, dropOff: null }),
      expect.objectContaining({ sessions: 3, ofPrevious: 75, ofFirst: 75, dropOff: 1 }),
      expect.objectContaining({ sessions: 2, ofPrevious: 66.7, ofFirst: 50, dropOff: 1 }),
      expect.objectContaining({ sessions: 1, ofPrevious: 50, ofFirst: 25, dropOff: 1 }),
    ]);
  });

  it("counts a session once however often it repeats a step", () => {
    expect(counts(events("a", "view_item", "view_item", "add_to_cart", "add_to_cart"))).toEqual([
      1, 1, 0, 0,
    ]);
  });

  it("does not count later steps reached without the earlier ones", () => {
    expect(counts(events("a", "add_to_cart", "purchase"))).toEqual([0, 0, 0, 0]);
    expect(computeFunnel(events("a", "add_to_cart")).totalSessions).toBe(1);
  });

  it("requires steps in order within a session, across interleaved sessions", () => {
    expect(
      counts([
        { sessionId: "a", name: "view_item" },
        { sessionId: "b", name: "add_to_cart" },
        { sessionId: "a", name: "add_to_cart" },
        { sessionId: "b", name: "view_item" },
      ]),
    ).toEqual([2, 1, 0, 0]);
  });
});

describe("beacons and privacy", () => {
  it("accepts only the two browser-reported events", () => {
    expect(analyticsBeaconSchema.safeParse({ name: "begin_checkout" }).success).toBe(true);
    expect(
      analyticsBeaconSchema.safeParse({ name: "view_item", productHandle: "mug" }).success,
    ).toBe(true);
    expect(analyticsBeaconSchema.safeParse({ name: "view_item" }).success).toBe(false);
    expect(analyticsBeaconSchema.safeParse({ name: "purchase" }).success).toBe(false);
  });

  it("honors Global Privacy Control only when the header is exactly 1", () => {
    expect(honorsPrivacySignal("1")).toBe(true);
    expect(honorsPrivacySignal("0")).toBe(false);
    expect(honorsPrivacySignal(null)).toBe(false);
  });
});
