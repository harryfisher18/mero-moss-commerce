import { expect, type Locator, test } from "@playwright/test";
import { DEMO_MERCHANT, query, visible } from "./helpers";

const STAND = "prod_oak-monitor-stand";

const shown = (locator: Locator) => locator.locator("visible=true");

function restoreStand() {
  query((db) => {
    db.prepare("UPDATE products SET seo_description = '' WHERE id = ?").run(STAND);
    db.prepare("DELETE FROM content_drafts WHERE product_id = ?").run(STAND);
  });
}

/** Follows DEMO_TOUR.md step by step, using the same names a reader is told to select. */
test("the demo tour works exactly as written", async ({ page }) => {
  test.setTimeout(120_000);
  restoreStand();
  try {
    const consoleMenu = () => shown(page.getByRole("navigation", { name: "Merchant" }));
    const select = (name: string | RegExp, role: "link" | "button" = "link") =>
      shown(page.getByRole(role, { name })).first().click();

    // 1. Shop and place an order.
    await page.goto("/");
    await shown(page.getByRole("navigation", { name: "Primary" }))
      .getByRole("link", { name: "Workspace" })
      .click();
    await expect(page).toHaveURL(/\/collections\/workspace/);
    await select("Brass Task Lamp");
    await expect(page).toHaveURL(/\/products\/brass-task-lamp/);
    const add = visible(page, "add-to-cart");
    await add.getByRole("button", { name: "Add to cart" }).click();
    await expect(add.getByRole("status")).toContainText("Added to your cart.");
    await select(/^Cart/);
    await expect(page).toHaveURL(/\/cart$/);
    await select("Continue to checkout");
    await expect(page).toHaveURL(/\/checkout$/);
    const form = visible(page, "checkout-form");
    await form.getByLabel("Email", { exact: true }).fill("reader@example.com");
    await form.getByLabel("Full name").fill("Sam Reader");
    await form.getByLabel("Address", { exact: true }).fill("1 Tour Road");
    await form.getByLabel("City").fill("Portland");
    await form.getByLabel("State").selectOption({ label: "Oregon" });
    await form.getByLabel("ZIP code").fill("97205");
    await form.getByLabel(/I understand this is a simulated order/).check();
    await form.getByRole("button", { name: "Place simulated order" }).click();
    await expect(page).toHaveURL(/\/checkout\/confirmation$/);
    const orderNumber = (await visible(page, "order-number").textContent()) ?? "";
    expect(orderNumber).toMatch(/^MM-/);
    await expect
      .poll(() =>
        query(
          (db) =>
            db.prepare("SELECT status FROM outbox_events WHERE subject = ?").get(orderNumber)
              ?.status,
        ),
      )
      .toBe("succeeded");

    // 2. Open the merchant console.
    await page.goto("/admin");
    const login = visible(page, "login-form");
    await login.getByLabel("Email").fill(DEMO_MERCHANT.email);
    await login.getByLabel("Password").fill(DEMO_MERCHANT.password);
    await login.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin\/overview$/);
    await consoleMenu().getByRole("link", { name: "Orders" }).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(page.locator("[data-testid=order-row]:visible").first()).toHaveAttribute(
      "data-order-number",
      orderNumber,
    );
    await select(orderNumber);
    await expect(visible(page, "order-automation")).toContainText("Ship zone: West");

    // 3. Watch the automation.
    await consoleMenu().getByRole("link", { name: "Automations" }).click();
    await expect(page).toHaveURL(/\/admin\/automations$/);
    await select(orderNumber);
    const detail = visible(page, "event-detail");
    await expect(detail).toContainText("Preview only · not sent");
    await detail.getByRole("button", { name: "Replay event" }).click();
    await expect(detail.getByTestId("event-action-status")).toContainText("No new effects");
    await select("All automation events");
    await expect(page).toHaveURL(/\/admin\/automations$/);
    await select("Start dead-letter drill", "button");
    await expect(page).toHaveURL(/\/admin\/automations\/[0-9a-f-]{36}$/);
    const drill = visible(page, "event-detail");
    const status = drill.getByTestId("event-action-status");
    for (const expected of ["Attempt 2 failed", "Attempt 3 failed", "Attempt 4 failed"]) {
      await drill.getByRole("button", { name: "Retry now" }).click();
      await expect(status).toContainText(expected);
    }
    await drill.getByRole("button", { name: "Retry now" }).click();
    await expect(status).toContainText("dead letter queue");

    // 4. Ask the shopping advisor.
    await consoleMenu().getByRole("link", { name: "View store" }).click();
    await shown(page.getByRole("navigation", { name: "Primary" }))
      .getByRole("link", { name: "Ask an advisor" })
      .click();
    await expect(page).toHaveURL(/\/advisor$/);
    const ask = visible(page, "advisor-form");
    await ask.getByLabel("Your question").fill("Travel gifts under $50");
    await ask.getByRole("button", { name: "Ask" }).click();
    await expect(visible(page, "advisor-card").first()).toBeVisible();

    // 5. Draft product copy.
    await page.goto("/admin");
    await consoleMenu().getByRole("link", { name: "Products" }).click();
    await select("Oak Monitor Stand");
    await select("Content Studio");
    await select("Generate a new draft", "button");
    const draft = visible(page, "latest-draft");
    await expect(draft.getByTestId("draft-source")).toHaveText("Rules-based draft");
    await expect(draft.getByTestId("constraint-checks")).toContainText("All factual checks pass");
    await expect(draft.getByTestId("draft-diff")).toBeVisible();
    await draft.getByRole("button", { name: "Approve and publish" }).click();
    await expect(visible(page, "approved-notice")).toContainText("published to the demo catalog");

    // 6. Compare before and after.
    await consoleMenu().getByRole("link", { name: "Upgrade Lab" }).click();
    await expect(visible(page, "lab-disclaimer")).toContainText("Illustrative, not measured.");
    await select("Linen Storage Bin");
    await expect(page).toHaveURL(/product=linen-storage-bin/);
    const before = visible(page, "lab-before");
    await before.getByLabel("Option").selectOption({ label: "Moss" });
    await before.getByRole("button", { name: "Add" }).click();
    await expect(before.getByTestId("lab-before-message")).toContainText("there was a problem");
    const after = visible(page, "lab-after");
    await after.getByRole("button", { name: /^Moss/ }).click();
    await expect(after.getByTestId("lab-after-availability")).toHaveText("Sold out");
    await select("Product discovery");
    await select("Travel gifts under $50");
    await expect(visible(page, "lab-after").getByTestId("lab-advisor-card").first()).toBeVisible();
    await select("Order operations");
    await expect(visible(page, "lab-order-note")).toBeVisible();

    // Also worth opening.
    for (const [name, url] of [
      ["Analytics", /\/admin\/analytics$/],
      ["Lifecycle", /\/admin\/lifecycle$/],
      ["Requests", /\/admin\/support$/],
      ["Integrations", /\/admin\/integrations$/],
    ] as const) {
      await consoleMenu().getByRole("link", { name }).click();
      await expect(page).toHaveURL(url);
    }
  } finally {
    restoreStand();
  }
});
