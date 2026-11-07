import { expect, test } from "@playwright/test";
import { checkout, signInAsMerchant, stockOf, visible } from "./helpers";

const NAPKINS_OAT = "var_mm-tk-lns-oat"; // Linen Napkins (Set of 4), Oat, $36.00

/**
 * Journey 1 from the product requirements: home → collection → filter → product →
 * variant → cart → quantity → demo checkout → order visible in the merchant console.
 */
test("Journey 1: shopper to order, visible to the merchant", async ({ page, isMobile }) => {
  const stockBefore = stockOf(NAPKINS_OAT);

  // Home → collection
  await page.goto("/");
  await page.getByRole("link", { name: "Shop the collection" }).click();
  await expect(page).toHaveURL(/\/collections\/all$/);

  // Filter by colour
  const filters = page.locator("details:visible", { hasText: "Filters" });
  if (!(await filters.evaluate((el) => (el as HTMLDetailsElement).open))) {
    await filters.locator("summary").click();
  }
  await page.getByRole("group", { name: "Color" }).getByLabel("Oat").check();
  await expect(page).toHaveURL(/color=Oat/);

  // Product (deep-linked to the Oat variant) → change and re-pick the variant
  await page.getByRole("link", { name: "Linen Napkins (Set of 4)" }).click();
  await expect(page).toHaveURL(/\/products\/linen-napkins-set\?variant=var_mm-tk-lns-oat/);
  const detail = visible(page, "product-detail");
  await detail.getByRole("link", { name: /^Sage/ }).click();
  await expect(page).toHaveURL(/variant=var_mm-tk-lns-sge/);
  await detail.getByRole("link", { name: /^Oat/ }).click();
  await expect(page).toHaveURL(/variant=var_mm-tk-lns-oat/);

  // Add to cart → adjust quantity in the cart
  const addForm = visible(page, "add-to-cart");
  await addForm.getByLabel("Quantity").fill("3");
  await addForm.getByRole("button", { name: "Add to cart" }).click();
  await expect(addForm.getByRole("status")).toContainText("You now have 3 items.");
  await addForm.getByRole("link", { name: "View cart" }).click();

  const line = page.locator("[data-testid=cart-line]:visible");
  await line.getByLabel(/Quantity/).fill("2");
  await line.getByRole("button", { name: /Update/ }).click();
  await expect(visible(page, "cart-summary").getByTestId("cart-total")).toHaveText("$80.00");

  // Simulated checkout ($72.00 + $8.00 shipping)
  const orderNumber = await checkout(page);
  await expect(visible(page, "order-total")).toHaveText("$80.00");
  expect(stockOf(NAPKINS_OAT)).toBe(stockBefore - 2);

  // The merchant sees the same order immediately
  await signInAsMerchant(page);
  await expect(page).toHaveURL(/\/admin\/orders$/);
  const row = page.locator(`[data-testid=order-row][data-order-number="${orderNumber}"]:visible`);
  await expect(row).toBeVisible();
  await expect(row.getByTestId("order-row-total")).toHaveText("$80.00");
  await expect(row.getByTestId("order-status")).toHaveText("Placed");

  await row.getByRole("link", { name: orderNumber, exact: true }).click();
  const order = visible(page, "admin-order-detail");
  await expect(order).toContainText("Linen Napkins (Set of 4) · Oat");
  await expect(order).toContainText("× 2");
  await expect(order.getByTestId("admin-order-total")).toHaveText("$80.00");
  if (!isMobile) await expect(order).toContainText("Portland, Oregon 97205");
});
