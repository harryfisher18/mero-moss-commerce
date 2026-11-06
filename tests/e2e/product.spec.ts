import { DatabaseSync } from "node:sqlite";
import { expect, type Page, test } from "@playwright/test";

// Same isolated database the E2E web server uses (see playwright.config.ts).
const E2E_DB_PATH = ".data/e2e.db";

const detail = (page: Page) => page.locator("[data-testid=product-detail]:visible");
const option = (page: Page, name: string, value: string) =>
  detail(page)
    .getByRole("list", { name: new RegExp(`^${name}:`) })
    .getByRole("link", {
      name: new RegExp(`^${value}`),
    });

function setProductStatus(handle: string, status: "active" | "draft") {
  const db = new DatabaseSync(E2E_DB_PATH);
  try {
    db.prepare("UPDATE products SET status = ? WHERE handle = ?").run(status, handle);
  } finally {
    db.close();
  }
}

test.describe("product detail", () => {
  test("shopper opens a product from a collection and selects variants", async ({ page }) => {
    await page.goto("/collections/workspace");
    await page.getByRole("link", { name: "Felt Desk Mat" }).click();
    await expect(page).toHaveURL(/\/products\/felt-desk-mat$/);
    await expect(page.getByRole("heading", { level: 1, name: "Felt Desk Mat" })).toBeVisible();

    // Default: first in-stock variant (Charcoal / Medium).
    await expect(detail(page).getByTestId("product-price")).toContainText("$48.00");
    await expect(detail(page).getByTestId("product-availability")).toHaveText("In stock");
    await expect(option(page, "Color", "Charcoal")).toHaveAttribute("aria-current", "true");
    await expect(option(page, "Size", "Medium")).toHaveAttribute("aria-current", "true");

    await option(page, "Size", "Large").click();
    await expect(page).toHaveURL(/variant=var_mm-ws-fdm-chr-l/);
    await expect(detail(page).getByTestId("product-price")).toContainText("$58.00");
    await expect(detail(page).getByTestId("product-sku")).toHaveText("MM-WS-FDM-CHR-L");

    // Oat keeps Large: that exact combination exists but is sold out.
    await option(page, "Color", "Oat").click();
    await expect(page).toHaveURL(/variant=var_mm-ws-fdm-oat-l/);
    await expect(detail(page).getByTestId("product-availability")).toHaveText("Sold out");
    await expect(option(page, "Color", "Oat")).toHaveAttribute("aria-current", "true");

    await option(page, "Size", "Medium").click();
    await expect(page).toHaveURL(/variant=var_mm-ws-fdm-oat-m/);
    await expect(detail(page).getByTestId("product-availability")).toHaveText("In stock");
    await expect(detail(page).getByTestId("product-price")).toContainText("$48.00");
  });

  test("shows stored policies and related products", async ({ page }) => {
    await page.goto("/products/walnut-desk-organizer");
    const shipping = detail(page).getByTestId("policy-shipping");
    await expect(shipping).toContainText("Free standard shipping on US orders of $75 or more.");
    await shipping.locator("summary").click();
    await expect(shipping).toContainText("Delivery times are estimates, not guarantees.");
    await expect(detail(page).getByTestId("policy-returns")).toContainText("within 30 days");

    const related = page.getByRole("region", { name: "You may also like" });
    await expect(related.getByTestId("product-card")).toHaveCount(4);
    await expect(related.locator("[data-handle=walnut-desk-organizer]")).toHaveCount(0);
  });

  test("filtered collection cards deep-link to a matching variant", async ({ page }) => {
    await page.goto("/collections/workspace?color=Oat");
    await page.getByRole("link", { name: "Felt Desk Mat" }).click();
    await expect(page).toHaveURL(/\/products\/felt-desk-mat\?variant=var_mm-ws-fdm-oat-m/);
    await expect(option(page, "Color", "Oat")).toHaveAttribute("aria-current", "true");
  });

  test("tampered variant ids fall back to the default variant", async ({ page }) => {
    const response = await page.goto("/products/felt-desk-mat?variant=var_not-a-real-variant");
    expect(response?.status()).toBe(200);
    await expect(detail(page).getByTestId("product-sku")).toHaveText("MM-WS-FDM-CHR-M");
  });

  test("unknown and unpublished products return a real 404", async ({ page }) => {
    expect((await page.goto("/products/not-a-product"))?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "We couldn’t find that page." }),
    ).toBeVisible();

    setProductStatus("oak-monitor-stand", "draft");
    try {
      expect((await page.goto("/products/oak-monitor-stand"))?.status()).toBe(404);
    } finally {
      setProductStatus("oak-monitor-stand", "active");
    }
    expect((await page.goto("/products/oak-monitor-stand"))?.status()).toBe(200);
  });
});
