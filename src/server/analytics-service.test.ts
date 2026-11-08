import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { money } from "@/domain/commerce/money";
import { AnalyticsService } from "@/server/analytics-service";
import { type Database, openDatabase } from "@/server/db/database";

let db: Database;
let service: AnalyticsService;
let tick: number;

beforeEach(() => {
  db = openDatabase(":memory:");
  tick = 0;
  service = new AnalyticsService(db, () => `2026-11-08T12:00:0${String(tick++)}.000Z`);
});

afterEach(() => db.close());

describe("AnalyticsService", () => {
  it("has no storage for personal data", () => {
    const columns = db
      .prepare("SELECT name FROM pragma_table_info('analytics_events')")
      .all()
      .map((row) => String(row.name));
    expect(columns.sort()).toEqual([
      "created_at",
      "currency",
      "id",
      "name",
      "product_id",
      "quantity",
      "session_id",
      "value_minor",
    ]);
  });

  it("builds the funnel from recorded events, oldest first", () => {
    service.record("s1", { name: "view_item", productId: "prod_lamp" });
    service.record("s2", { name: "view_item", productId: "prod_lamp" });
    service.record("s1", {
      name: "add_to_cart",
      productId: "prod_lamp",
      quantity: 2,
      value: money(29600, "USD"),
    });
    const report = service.report();
    expect(report.funnel.totalSessions).toBe(2);
    expect(report.funnel.rows.map((row) => row.sessions)).toEqual([2, 1, 0, 0]);
    expect(report).toMatchObject({
      eventCount: 3,
      truncated: false,
      firstEventAt: "2026-11-08T12:00:00.000Z",
      lastEventAt: "2026-11-08T12:00:02.000Z",
    });
  });

  it("totals simulated order value from purchase events only", () => {
    service.record("s1", { name: "add_to_cart", value: money(5000, "USD") });
    service.record("s1", { name: "purchase", quantity: 1, value: money(5800, "USD") });
    service.record("s2", { name: "purchase", quantity: 2, value: money(1200, "USD") });
    expect(service.report().simulatedOrderValue).toEqual([money(7000, "USD")]);
  });

  it("reports honestly when there is nothing recorded", () => {
    expect(service.report()).toMatchObject({
      eventCount: 0,
      firstEventAt: null,
      lastEventAt: null,
      simulatedOrderValue: [],
      funnel: { totalSessions: 0 },
    });
  });

  it("uses only the most recent events past the limit and says so", () => {
    service.record("old", { name: "view_item" });
    service.record("s1", { name: "view_item" });
    service.record("s1", { name: "add_to_cart" });
    const report = service.report(2);
    expect(report).toMatchObject({ truncated: true, eventCount: 2 });
    expect(report.funnel.totalSessions).toBe(1);
  });

  it("rejects event names outside the funnel at the database", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO analytics_events (session_id, name, created_at) VALUES ('s', 'email_seen', 't')",
        )
        .run(),
    ).toThrow();
  });
});
