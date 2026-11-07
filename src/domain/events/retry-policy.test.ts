import { describe, expect, it } from "vitest";
import { displayStatus, drillShouldFail } from "./outbox";
import {
  formatDelay,
  planAfterFailure,
  RETRY_POLICY,
  retryDelayMs,
  retrySchedule,
} from "./retry-policy";

const NOW = new Date("2026-11-08T12:00:00.000Z");

describe("retry policy", () => {
  it("doubles the delay after each failure", () => {
    expect([1, 2, 3, 4].map((n) => retryDelayMs(n))).toEqual([10_000, 20_000, 40_000, 80_000]);
  });

  it("caps the delay at the maximum, even for huge attempt counts", () => {
    const policy = { maxAttempts: 50, baseDelayMs: 10_000, maxDelayMs: 60_000 };
    expect(retryDelayMs(3, policy)).toBe(40_000);
    expect(retryDelayMs(4, policy)).toBe(60_000);
    expect(retryDelayMs(1_000, policy)).toBe(60_000);
  });

  it("rejects attempt counts below one", () => {
    expect(() => retryDelayMs(0)).toThrow(RangeError);
    expect(() => retryDelayMs(1.5)).toThrow(RangeError);
  });

  it("lists one automatic retry per attempt after the first", () => {
    expect(retrySchedule()).toEqual([10_000, 20_000, 40_000, 80_000]);
    expect(retrySchedule().length).toBe(RETRY_POLICY.maxAttempts - 1);
  });

  it("schedules the next attempt from now while attempts remain", () => {
    expect(planAfterFailure({ attempts: 1, maxAttempts: 5, permanent: false }, NOW)).toEqual({
      outcome: "retry",
      delayMs: 10_000,
      nextAttemptAt: "2026-11-08T12:00:10.000Z",
    });
    expect(planAfterFailure({ attempts: 4, maxAttempts: 5, permanent: false }, NOW)).toEqual({
      outcome: "retry",
      delayMs: 80_000,
      nextAttemptAt: "2026-11-08T12:01:20.000Z",
    });
  });

  it("dead-letters after the final attempt", () => {
    expect(planAfterFailure({ attempts: 5, maxAttempts: 5, permanent: false }, NOW)).toEqual({
      outcome: "dead",
    });
  });

  it("dead-letters permanent failures immediately", () => {
    expect(planAfterFailure({ attempts: 1, maxAttempts: 5, permanent: true }, NOW)).toEqual({
      outcome: "dead",
    });
  });

  it("formats delays for people", () => {
    expect(formatDelay(10_000)).toBe("10 s");
    expect(formatDelay(80_000)).toBe("1 min 20 s");
    expect(formatDelay(600_000)).toBe("10 min");
  });
});

describe("event status and drills", () => {
  it("shows pending events with failed attempts as retry scheduled", () => {
    expect(displayStatus("pending", 0)).toBe("queued");
    expect(displayStatus("pending", 2)).toBe("retrying");
    expect(displayStatus("succeeded", 1)).toBe("succeeded");
    expect(displayStatus("dead", 5)).toBe("dead");
  });

  it("fails the recovering drill twice, then succeeds", () => {
    expect([0, 1, 2].map((n) => drillShouldFail("recovers", n))).toEqual([true, true, false]);
  });

  it("always fails the dead-letter drill", () => {
    expect([0, 4, 100].every((n) => drillShouldFail("always_fails", n))).toBe(true);
  });
});
