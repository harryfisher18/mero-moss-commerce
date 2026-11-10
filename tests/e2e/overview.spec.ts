import { expect, type Page, test } from "@playwright/test";
import { DEMO_MERCHANT, query, visible } from "./helpers";

const count = (sql: string) => query((db) => Number(db.prepare(sql).get()?.n));

const figure = (page: Page, key: string) =>
  visible(page, `figure-${key}`).getByTestId("figure-value");

test.describe("merchant overview", () => {
  test("signing in lands on the overview, and every figure matches the database", async ({
    page,
  }) => {
    await page.goto("/admin");
    const login = visible(page, "login-form");
    await login.getByLabel("Email").fill(DEMO_MERCHANT.email);
    await login.getByLabel("Password").fill(DEMO_MERCHANT.password);
    await login.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/overview$/);
    await expect(visible(page, "overview-disclaimer")).toContainText(
      "Demo data, counted just now.",
    );

    for (const status of ["placed", "processing", "fulfilled", "cancelled"]) {
      await expect(figure(page, status)).toHaveText(
        String(count(`SELECT COUNT(*) AS n FROM orders WHERE status = '${status}'`)),
      );
    }
    await expect(figure(page, "review")).toHaveText(
      String(
        count(`SELECT COUNT(*) AS n FROM orders o WHERE o.status = 'placed'
          AND EXISTS (SELECT 1 FROM order_tags t WHERE t.order_id = o.id AND t.tag LIKE 'review:%')
          AND NOT EXISTS (SELECT 1 FROM order_reviews r WHERE r.order_id = o.id)`),
      ),
    );
    await expect(figure(page, "dead")).toHaveText(
      String(count("SELECT COUNT(*) AS n FROM outbox_events WHERE status = 'dead'")),
    );
    await expect(figure(page, "retrying")).toHaveText(
      String(
        count("SELECT COUNT(*) AS n FROM outbox_events WHERE status = 'pending' AND attempts > 0"),
      ),
    );
    await expect(figure(page, "requests")).toHaveText(
      String(count("SELECT COUNT(*) AS n FROM support_requests")),
    );
    const soldOut =
      count(`SELECT COUNT(*) AS n FROM variants v JOIN products p ON p.id = v.product_id
      WHERE p.status = 'active' AND v.inventory_quantity <= 0`);
    await expect(visible(page, "alerts-sold-out").getByRole("heading")).toHaveText(
      `Sold out (${String(soldOut)})`,
    );

    // No invented results: no percentages or currency amounts anywhere on the page.
    await expect(page.locator("main")).not.toContainText(/%|\$\d/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test("figures link to where they can be acted on", async ({ page }) => {
    await page.goto("/admin/login?next=%2Fadmin%2Foverview");
    const login = visible(page, "login-form");
    await login.getByLabel("Email").fill(DEMO_MERCHANT.email);
    await login.getByLabel("Password").fill(DEMO_MERCHANT.password);
    await login.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/overview$/);

    await visible(page, "figure-review").click();
    await expect(page).toHaveURL(/\/admin\/orders\?view=review$/);
    await page.goBack();
    await visible(page, "figure-dead").click();
    await expect(page).toHaveURL(/\/admin\/automations\?status=dead$/);
  });

  test("is merchant-only", async ({ page }) => {
    const response = await page.request.get("/admin/overview", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/admin/login?next=");
  });
});
