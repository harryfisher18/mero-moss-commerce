import { DatabaseSync } from "node:sqlite";
import { expect, type Page, test } from "@playwright/test";

const E2E_DB_PATH = ".data/e2e.db";

const headerCart = (page: Page) => page.getByTestId("header-cart");
const summary = (page: Page) => page.locator("[data-testid=cart-summary]:visible");
const addForm = (page: Page) => page.locator("[data-testid=add-to-cart]:visible");

function setInventory(variantId: string, quantity: number) {
  const db = new DatabaseSync(E2E_DB_PATH);
  try {
    db.prepare("UPDATE variants SET inventory_quantity = ? WHERE id = ?").run(quantity, variantId);
  } finally {
    db.close();
  }
}

async function addToCart(page: Page, path: string, quantity: number) {
  await page.goto(path);
  await addForm(page).getByLabel("Quantity").fill(String(quantity));
  await addForm(page).getByRole("button", { name: "Add to cart" }).click();
}

test.describe("cart", () => {
  test("add, update, persist and remove", async ({ page }) => {
    await addToCart(page, "/products/felt-desk-mat?variant=var_mm-ws-fdm-chr-l", 2);
    await expect(addForm(page).getByRole("status")).toContainText(
      "Added to your cart. You now have 2 items.",
    );
    await expect(headerCart(page)).toHaveAttribute("aria-label", "Cart 2 items");

    await addForm(page).getByRole("link", { name: "View cart" }).click();
    await expect(page).toHaveURL(/\/cart$/);
    const line = page.locator("[data-testid=cart-line]:visible");
    await expect(line).toHaveCount(1);
    await expect(line).toContainText("Felt Desk Mat");
    await expect(line).toContainText("Charcoal / Large");
    await expect(line.getByTestId("line-total")).toHaveText("$116.00");
    await expect(summary(page).getByTestId("cart-subtotal")).toHaveText("$116.00");
    await expect(summary(page).getByTestId("cart-shipping")).toHaveText("Free");
    await expect(summary(page).getByTestId("cart-total")).toHaveText("$116.00");

    await line.getByLabel(/Quantity/).fill("1");
    await line.getByRole("button", { name: /Update/ }).click();
    await expect(line.getByRole("status")).toHaveText("Quantity updated.");
    await expect(summary(page).getByTestId("cart-subtotal")).toHaveText("$58.00");
    await expect(summary(page).getByTestId("cart-shipping")).toHaveText("$8.00");
    await expect(summary(page).getByTestId("cart-total")).toHaveText("$66.00");
    await expect(summary(page)).toContainText("Add $17.00 more for free standard shipping.");

    await page.reload();
    await expect(summary(page).getByTestId("cart-subtotal")).toHaveText("$58.00");
    await expect(headerCart(page)).toHaveAttribute("aria-label", "Cart 1 item");

    await page
      .locator("[data-testid=cart-line]:visible")
      .getByRole("button", { name: /Remove/ })
      .click();
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
    await expect(headerCart(page)).toHaveAttribute("aria-label", "Cart 0 items");
  });

  test("the server enforces stock even when the browser is bypassed", async ({ page, browser }) => {
    await addToCart(page, "/products/cast-iron-trivet", 2);
    await expect(addForm(page).getByRole("status")).toContainText("You now have 2 items.");

    await addToCart(page, "/products/cast-iron-trivet", 1);
    await expect(addForm(page).getByRole("status")).toHaveText(
      "You already have all available stock of this item in your cart.",
    );

    await page.goto("/cart");
    const line = page.locator("[data-testid=cart-line]:visible");
    const quantity = line.getByLabel(/Quantity/);
    await expect(quantity).toHaveValue("2");
    // Simulate a tampered client: drop the browser-side bound and ask for more than exists.
    await quantity.evaluate((input) => input.removeAttribute("max"));
    await quantity.fill("3");
    await line.getByRole("button", { name: /Update/ }).click();
    await expect(line.getByRole("status")).toHaveText("Only 2 available. Please choose fewer.");
    await expect(summary(page).getByTestId("cart-subtotal")).toHaveText("$58.00");

    // Carts are per browser: a fresh visitor starts empty.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto("/cart");
    await expect(otherPage.getByText("Your cart is empty.")).toBeVisible();
    await other.close();
  });

  test("sold-out variants cannot be added", async ({ page }) => {
    await page.goto("/products/felt-desk-mat?variant=var_mm-ws-fdm-oat-l");
    await expect(
      page.getByText("This option is sold out. Please choose another option."),
    ).toBeVisible();
    await expect(addForm(page)).toHaveCount(0);
  });

  test("the cart flags items whose stock dropped after they were added", async ({ page }) => {
    const variant = "var_mm-tk-htm-chk"; // Hand-Thrown Mug, Chalk
    await addToCart(page, `/products/hand-thrown-mug?variant=${variant}`, 4);
    await expect(addForm(page).getByRole("status")).toContainText("You now have 4 items.");

    setInventory(variant, 1);
    try {
      await page.goto("/cart");
      const line = page.locator("[data-testid=cart-line]:visible");
      await expect(line).toContainText("Only 1 available now.");
      await expect(line.getByTestId("line-total")).toHaveText("$26.00");
      await expect(summary(page).getByTestId("cart-subtotal")).toHaveText("$26.00");
    } finally {
      setInventory(variant, 35);
    }
  });
});
