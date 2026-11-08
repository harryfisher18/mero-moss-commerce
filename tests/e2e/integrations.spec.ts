import { expect, test } from "@playwright/test";
import { signInAsMerchant, visible } from "./helpers";

const card = (page: import("@playwright/test").Page, id: string) =>
  page.locator(`[data-testid=integration][data-integration=${id}]:visible`);

test.describe("integrations status", () => {
  test("is merchant-only", async ({ page }) => {
    const response = await page.request.get("/admin/integrations", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/admin/login?next=");
  });

  test("with no credentials, everything is honestly in demo mode", async ({ page }) => {
    await signInAsMerchant(page, "/admin/integrations");

    await expect(card(page, "demo-catalog").getByTestId("demo-catalog-detail")).toHaveText(
      /^Local demo catalog with \d+ active products\.$/,
    );
    for (const id of ["demo-catalog", "shopify", "advisor-ai", "content-ai", "notifications"]) {
      await expect(card(page, id)).toHaveAttribute("data-state", "DEMO");
      await expect(card(page, id).getByTestId("integration-state")).toHaveText("Demo");
    }

    const shopify = card(page, "shopify");
    await expect(shopify).toContainText("No Shopify store has been connected or verified");
    await expect(shopify.getByTestId("shopify-settings")).toContainText(
      "SHOPIFY_ADMIN_ACCESS_TOKEN",
    );
    await expect(shopify.getByTestId("shopify-settings")).not.toContainText(/\bSet\b(?! )/);

    // Nothing to connect or verify, so no such control is rendered.
    await expect(page.locator("main").getByRole("button")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("Connected and verified");
    await expect(visible(page, "not-built")).toContainText("none is claimed");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
