import { expect, test } from "@playwright/test";
import { addToCart, DEMO_MERCHANT, query, signInAsMerchant, visible } from "./helpers";

const LAMP = "prod_brass-task-lamp";
const BRASS = "var_mm-ws-btl-brs"; // $148.00, stock 7
const BLACK = "var_mm-ws-btl-blk"; // $148.00, stock 12

/** Restores the seeded lamp so the desktop and mobile projects start from the same data. */
function restoreLamp() {
  query((db) => {
    db.prepare("UPDATE products SET status = 'active' WHERE id = ?").run(LAMP);
    db.prepare(
      "UPDATE variants SET price_minor = 14800, compare_at_minor = NULL, inventory_quantity = ? WHERE id = ?",
    ).run(7, BRASS);
    db.prepare(
      "UPDATE variants SET price_minor = 14800, compare_at_minor = NULL, inventory_quantity = ? WHERE id = ?",
    ).run(12, BLACK);
  });
}

const auditCount = () =>
  query((db) =>
    Number(
      db.prepare("SELECT COUNT(*) AS n FROM catalog_audit_events WHERE product_id = ?").get(LAMP)
        ?.n,
    ),
  );

/**
 * Journey 2 from the product requirements: a merchant edits price and stock in the console
 * and the storefront and cart reflect the new values; drafts disappear from the store.
 */
test("Journey 2: merchant edits propagate to the storefront and cart", async ({ page }) => {
  restoreLamp();
  try {
    // A shopper already has the brass lamp in their cart at $148.00.
    await addToCart(page, `/products/brass-task-lamp?variant=${BRASS}`, 1);

    // Merchant opens the product editor.
    await signInAsMerchant(page, "/admin/products");
    await page
      .locator("[data-testid=product-row][data-handle=brass-task-lamp]:visible")
      .getByRole("link", { name: "Brass Task Lamp" })
      .click();
    const editor = visible(page, "product-editor");
    const brass = editor.locator("[data-testid=variant-row][data-sku=MM-WS-BTL-BRS]");
    const black = editor.locator("[data-testid=variant-row][data-sku=MM-WS-BTL-BLK]");

    // Invalid input is rejected, kept in the form, and nothing is saved.
    const auditBefore = auditCount();
    await brass.getByLabel(/^Price/).fill("abc");
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(visible(page, "editor-status")).toHaveText("Please fix the highlighted fields.");
    await expect(brass.getByLabel(/^Price/)).toHaveValue("abc");
    await expect(brass.getByLabel(/^Price/)).toHaveAttribute("aria-invalid", "true");
    expect(auditCount()).toBe(auditBefore);

    // Valid edit: brass on sale, black sold out.
    await brass.getByLabel(/^Price/).fill("128");
    await brass.getByLabel(/^Compare-at/).fill("148.00");
    await black.getByLabel(/^Stock/).fill("0");
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(visible(page, "editor-status")).toHaveText(
      "Saved 3 changes. The storefront now shows the update.",
    );
    // Earlier runs (e.g. the other browser project) leave their own audit rows behind.
    expect(auditCount()).toBe(auditBefore + 3);
    const history = visible(page, "change-history");
    await expect(history.getByRole("listitem")).toHaveCount(auditBefore + 3);
    await expect(history).toContainText(DEMO_MERCHANT.email);
    await expect(history).toContainText("148.00 → 128.00");

    // Storefront reflects the new price, sale and stock immediately.
    await page.goto(`/products/brass-task-lamp?variant=${BRASS}`);
    const detail = visible(page, "product-detail");
    await expect(detail.getByTestId("product-price")).toContainText("$128.00");
    await expect(detail.getByTestId("product-price")).toContainText("$148.00");
    await expect(detail.getByTestId("product-price")).toContainText("Sale");
    await page.goto(`/products/brass-task-lamp?variant=${BLACK}`);
    await expect(visible(page, "product-detail").getByTestId("product-availability")).toHaveText(
      "Sold out",
    );
    await expect(visible(page, "add-to-cart")).toHaveCount(0);

    // The existing cart line is repriced from the catalog.
    await page.goto("/cart");
    await expect(
      page.locator("[data-testid=cart-line]:visible").getByTestId("line-total"),
    ).toHaveText("$128.00");

    // The shopping advisor answers from the same live catalog: new price, sold-out black.
    await page.goto("/advisor?q=brass%20task%20lamp");
    const advised = page.locator("[data-testid=advisor-card]:visible");
    await expect(advised).toHaveCount(1);
    await expect(advised).toHaveAttribute("data-variant-id", BRASS);
    await expect(advised.getByTestId("advisor-card-price")).toContainText("$128.00");
    await expect(advised.getByTestId("advisor-card-price")).toContainText("$148.00");

    // Unpublishing hides the product from the store (real 404) and its collection.
    await page.goto(`/admin/products/${LAMP}`);
    const editorAgain = visible(page, "product-editor");
    await editorAgain.getByLabel("Status").selectOption("draft");
    await editorAgain.getByRole("button", { name: "Save changes" }).click();
    await expect(visible(page, "editor-status")).toHaveText(
      "Saved 1 change. The storefront now shows the update.",
    );
    expect((await page.goto("/products/brass-task-lamp"))?.status()).toBe(404);
    await page.goto("/collections/workspace");
    await expect(page.locator("#results-heading:visible")).toHaveText("6 products");
  } finally {
    restoreLamp();
  }
});

test("product editor requires a merchant session", async ({ page }) => {
  const response = await page.request.get(`/admin/products/${LAMP}`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/admin/login?next=");
});
