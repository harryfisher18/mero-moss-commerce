import { expect, test } from "@playwright/test";
import { computeFunnel, type RecordedEvent } from "../../src/domain/analytics/funnel";
import { addToCart, checkout, query, signInAsMerchant, visible } from "./helpers";

const BIN_PATH = "/products/linen-storage-bin?variant=var_mm-ho-lsb-oat";

const eventsFor = (sessionId: string) =>
  query((db) =>
    db
      .prepare(
        "SELECT name, product_id, quantity, value_minor FROM analytics_events WHERE session_id = ? ORDER BY id",
      )
      .all(sessionId),
  ) as Array<{
    name: string;
    product_id: string | null;
    quantity: number | null;
    value_minor: number | null;
  }>;

const allEvents = (): RecordedEvent[] =>
  query((db) =>
    db
      .prepare("SELECT session_id AS sessionId, name FROM analytics_events ORDER BY id")
      .all()
      .map((row) => ({
        sessionId: String(row.sessionId),
        name: row.name as RecordedEvent["name"],
      })),
  );

const eventCount = () =>
  query((db) => Number(db.prepare("SELECT COUNT(*) AS n FROM analytics_events").get()?.n));

test.describe("first-party analytics", () => {
  test("a real session reaches purchase with no personal data, and the funnel matches", async ({
    page,
    context,
  }) => {
    await addToCart(page, BIN_PATH, 2);
    const orderNumber = await checkout(page);

    const sessionId = (await context.cookies()).find((c) => c.name === "mm_sid")?.value ?? "";
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    await expect
      .poll(() => eventsFor(sessionId).map((event) => event.name))
      .toEqual(["view_item", "add_to_cart", "begin_checkout", "purchase"]);

    const rows = eventsFor(sessionId);
    expect(rows[1]).toMatchObject({
      product_id: "prod_linen-storage-bin",
      quantity: 2,
      value_minor: 5600,
    });
    expect(rows[3]).toMatchObject({ product_id: null, quantity: 2, value_minor: 6400 });

    // Nothing stored can identify the shopper or link back to the order or cart.
    const stored = JSON.stringify(
      query((db) =>
        db.prepare("SELECT * FROM analytics_events WHERE session_id = ?").all(sessionId),
      ),
    );
    for (const secret of [
      "avery",
      "Avery",
      "Stone",
      "Elm Street",
      "Portland",
      "97205",
      orderNumber,
    ]) {
      expect(stored).not.toContain(secret);
    }
    const cartId = (await context.cookies()).find((c) => c.name === "mm_cart")?.value;
    if (cartId) expect(stored).not.toContain(cartId);

    await signInAsMerchant(page, "/admin/analytics");
    await expect(visible(page, "analytics-disclaimer")).toContainText("Demo-session data.");

    // Every number on the page comes from the recorded rows.
    const expected = computeFunnel(allEvents());
    await expect(visible(page, "analytics-sessions")).toHaveText(String(expected.totalSessions));
    for (const row of expected.rows) {
      await expect(
        page
          .locator(`[data-testid=funnel-row][data-step=${row.step}]:visible`)
          .getByTestId("funnel-sessions"),
      ).toHaveText(String(row.sessions));
    }
    expect(expected.rows[3]?.sessions).toBeGreaterThan(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test("the storefront discloses what is recorded", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("footer:visible")).toContainText("never your name, email or address");
  });

  test("Global Privacy Control means no cookie and no events", async ({ page, context }) => {
    await page.setExtraHTTPHeaders({ "Sec-GPC": "1" });
    const before = eventCount();
    await addToCart(page, BIN_PATH, 1);
    await page.goto("/cart");
    expect((await context.cookies()).some((c) => c.name === "mm_sid")).toBe(false);
    expect(eventCount()).toBe(before);
  });

  test("the beacon rejects forged and invalid reports", async ({ page, baseURL }) => {
    const before = eventCount();
    const origin = new URL(baseURL ?? "").origin;
    const post = (data: unknown, headers: Record<string, string>) =>
      page.request.post("/api/analytics", { data, headers }).then((r) => r.status());

    expect(await post({ name: "view_item", productHandle: "brass-task-lamp" }, {})).toBe(403);
    expect(
      await post(
        { name: "view_item", productHandle: "brass-task-lamp" },
        { Origin: "https://evil.example" },
      ),
    ).toBe(403);
    expect(await post({ name: "purchase" }, { Origin: origin })).toBe(400);
    expect(
      await post({ name: "view_item", productHandle: "no-such-thing" }, { Origin: origin }),
    ).toBe(404);
    // An empty cart cannot begin checkout.
    expect(await post({ name: "begin_checkout" }, { Origin: origin })).toBe(204);
    expect(eventCount()).toBe(before);
  });

  test("the analytics page is merchant-only", async ({ page }) => {
    const response = await page.request.get("/admin/analytics", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/admin/login?next=");
  });
});
