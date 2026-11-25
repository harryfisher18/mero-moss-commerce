import { expect, test } from "@playwright/test";
import { addToCart, checkout, DEMO_MERCHANT, query, signInAsMerchant, visible } from "./helpers";

const count = (table: string) =>
  query((db) => Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n));

test.describe("merchant settings", () => {
  test("is merchant-only", async ({ page }) => {
    const response = await page.request.get("/admin/settings", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/admin/login?next=");
  });

  test("shows the real configuration without any values", async ({ page }) => {
    await signInAsMerchant(page, "/admin/settings");
    await expect(visible(page, "login-mode")).toContainText("Public demo login.");
    // The E2E server runs with no credentials or keys.
    for (const name of ["MERCHANT_EMAIL", "ANTHROPIC_API_KEY", "SHOPIFY_ADMIN_ACCESS_TOKEN"]) {
      await expect(
        page.locator(`[data-testid=setting-state][data-name=${name}]:visible`),
      ).toHaveText("Not set");
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test("branding edits are previewed, validated, recorded and shown on the storefront", async ({
    page,
  }) => {
    const tagline = "Kept for years, used every day.";
    const announcement = "New table and kitchen pieces are in.";
    try {
      await signInAsMerchant(page, "/admin/settings");
      const form = visible(page, "branding-form");
      await form.getByLabel("Tagline").fill("");
      await form.getByRole("button", { name: "Save branding" }).click();
      await expect(form.getByTestId("branding-status")).toHaveText(
        "Please fix the highlighted fields.",
      );
      await expect(form.getByLabel("Tagline")).toHaveAttribute("aria-invalid", "true");
      await expect(form).toContainText("Tagline is required.");

      await form.getByLabel("Tagline").fill(tagline);
      await form.getByLabel("Announcement (optional)").fill(announcement);
      const preview = form.getByTestId("branding-preview");
      await expect(preview).toContainText(tagline);
      await expect(preview).toContainText(announcement);
      await form.getByRole("button", { name: "Save branding" }).click();
      await expect(form.getByTestId("branding-status")).toHaveText(
        "Saved. The storefront shows the new wording on its next page load.",
      );
      const history = visible(page, "branding-history");
      await expect(history).toContainText(`Announcement: (none) → ${announcement}`);
      await expect(history).toContainText(DEMO_MERCHANT.email);

      await page.goto("/");
      await expect(visible(page, "store-announcement")).toHaveText(announcement);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(tagline);
      await expect(visible(page, "footer-tagline")).toHaveText(tagline);
    } finally {
      query((db) => {
        db.prepare("DELETE FROM store_branding").run();
      });
    }
    await page.goto("/");
    await expect(page.locator("[data-testid=store-announcement]")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Well-made essentials for everyday living.",
    );
  });

  test("a confirmed reset restores the seeded store and keeps the merchant signed in", async ({
    page,
  }) => {
    await addToCart(page, "/products/stoneware-dinner-plate?variant=var_mm-tk-sdp-chk", 1);
    await checkout(page);
    const products = count("products");
    expect(count("orders")).toBeGreaterThan(0);

    await signInAsMerchant(page, "/admin/settings");
    const form = visible(page, "demo-reset");
    await form.getByLabel(/Type reset demo store to confirm/).fill("reset");
    await form.getByRole("button", { name: "Reset demo store" }).click();
    await expect(form.getByTestId("demo-reset-status")).toHaveText(
      "Type the confirmation phrase exactly to reset.",
    );
    expect(count("orders")).toBeGreaterThan(0);

    await form.getByLabel(/Type reset demo store to confirm/).fill("reset demo store");
    await form.getByRole("button", { name: "Reset demo store" }).click();
    await expect(form.getByTestId("demo-reset-status")).toContainText(
      /^The demo store was reset: \d+ records removed and the demo catalog restored\.$/,
    );
    expect(count("orders")).toBe(0);
    expect(count("outbox_events")).toBe(0);
    expect(count("products")).toBe(products);
    // The reset itself is recorded and listed, and survives the reset it describes.
    expect(count("demo_resets")).toBeGreaterThan(0);
    const history = visible(page, "reset-history");
    await expect(history.getByRole("listitem").first()).toContainText(DEMO_MERCHANT.email);
    await expect(history.getByRole("listitem").first()).toContainText(/\d+ records removed/);

    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(page.locator("main")).toContainText("No orders yet.");
  });
});
