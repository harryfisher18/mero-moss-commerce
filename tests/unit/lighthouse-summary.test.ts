import { describe, expect, it } from "vitest";
import {
  budgetFailures,
  medianRun,
  type PageResult,
  RECORD_END,
  RECORD_START,
  renderSummary,
  replaceRecorded,
} from "../../scripts/lighthouse-summary";

const page = (overrides: Partial<PageResult> = {}): PageResult => ({
  path: "/",
  runs: 3,
  performance: 90,
  accessibility: 100,
  bestPractices: 100,
  seo: 100,
  fcpMs: 1200,
  lcpMs: 2500,
  tbtMs: 40.4,
  cls: 0,
  speedIndexMs: 1500,
  notPassing: [],
  ...overrides,
});

const ENV = {
  commit: "abc1234",
  fetchedAt: "2026-11-08T12:00:00.000Z",
  lighthouseVersion: "13.6.0",
  host: "linux, 4 CPUs, CI runner",
  browser: "Chrome",
  device: "mobile emulation, 412×823 at 1.75x",
  network: "simulate throttling: 150 ms RTT, 1638 Kbps down, 4x CPU slowdown",
};

describe("medianRun", () => {
  it("picks the middle run by performance score", () => {
    expect(medianRun([{ performance: 90 }, { performance: 50 }, { performance: 70 }])).toEqual({
      performance: 70,
    });
  });

  it("refuses to summarize nothing", () => {
    expect(() => medianRun([])).toThrow();
  });
});

describe("budgetFailures", () => {
  it("passes results within budget, whatever the lab timings are", () => {
    expect(budgetFailures([page({ performance: 40, lcpMs: 9000 })])).toEqual([]);
  });

  it("reports accessibility and layout shift problems per page", () => {
    expect(budgetFailures([page({ path: "/a", accessibility: 96, cls: 0.2 })])).toEqual([
      "/a: accessibility 96 is below 100",
      "/a: layout shift 0.2 is above 0.1",
    ]);
  });
});

describe("report", () => {
  it("states the conditions alongside the numbers", () => {
    const summary = renderSummary([page({ path: "/products/x" })], ENV);
    expect(summary).toContain(
      "| `/products/x` | 90 | 100 | 100 | 100 | 1.2 s | 2.5 s | 40 ms | 0.000 |",
    );
    expect(summary).toContain("Median of 3 runs per page");
    expect(summary).toContain("150 ms RTT, 1638 Kbps down, 4x CPU slowdown");
    expect(summary).toContain("mobile emulation, 412×823");
    expect(summary).toContain("abc1234");
  });

  it("replaces only the recorded block", () => {
    const document = `before\n${RECORD_START}\nold\n${RECORD_END}\nafter`;
    expect(replaceRecorded(document, "new")).toBe(
      `before\n${RECORD_START}\n\nnew\n\n${RECORD_END}\nafter`,
    );
    expect(() => replaceRecorded("no markers", "new")).toThrow();
  });
});
