import { DatabaseSync } from "node:sqlite";
import { expect, type Page, test } from "@playwright/test";

const E2E_DB_PATH = ".data/e2e.db";
const JAR_1L = "var_mm-tk-gpj-10"; // Glass Pantry Jar, 1 L, $18.00
const CEDAR = "var_mm-ho-cdb-8"; // Cedar Drawer Blocks, $18.00

function query<T>(fn: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(E2E_DB_PATH);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}
const stockOf = (variantId: string) =>
  query((db) =>
    Number(
      db.prepare("SELECT inventory_quantity AS q FROM variants WHERE id = ?").get(variantId)?.q,
    ),
  );
const setStock = (variantId: string, quantity: number) =>
  query((db) =>
    db.prepare("UPDATE variants SET inventory_quantity = ? WHERE id = ?").run(quantity, variantId),
  );
const orderCount = () =>
  query((db) => Number(db.prepare("SELECT COUNT(*) AS n FROM orders").get()?.n));

const addForm = (page: Page) => page.locator("[data-testid=add-to-cart]:visible");
const checkoutForm = (page: Page) => page.locator("[data-testid=checkout-form]:visible");

async function addToCart(page: Page, path: string, quantity: number) {
  await page.goto(path);
  await addForm(page).getByLabel("Quantity").fill(String(quantity));
  await addForm(page).getByRole("button", { name: "Add to cart" }).click();
  await expect(addForm(page).getByRole("status")).toContainText("Added to your cart.");
}

async function fillShipping(page: Page) {
  const form = checkoutForm(page);
  await form.getByLabel("Email", { exact: true }).fill("avery@example.com");
  await form.getByLabel("Full name").fill("Avery Stone");
  await form.getByLabel("Address", { exact: true }).fill("12 Elm Street");
  await form.getByLabel("City").fill("Portland");
  await form.getByLabel("State").selectOption("OR");
  await form.getByLabel("ZIP code").fill("97205");
  await form.getByLabel(/I understand this is a simulated order/).check();
}

test.describe("demo checkout", () => {
  test("shopper places a simulated order that decrements stock", async ({ page }) => {
    const stockBefore = stockOf(JAR_1L);
    const ordersBefore = orderCount();

    await addToCart(page, `/products/glass-pantry-jar?variant=${JAR_1L}`, 2);
    await page.goto("/cart");
    await page.getByRole("link", { name: "Continue to checkout" }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    await expect(page.getByTestId("simulated-order-notice")).toContainText(
      "Simulated order · No payment",
    );
    // No payment fields of any kind.
    await expect(page.locator("input[autocomplete^=cc-]")).toHaveCount(0);
    await expect(page.getByLabel(/card/i)).toHaveCount(0);
    await expect(page.locator("[data-testid=checkout-summary]:visible")).toContainText("$44.00");

    await fillShipping(page);
    await checkoutForm(page).getByRole("button", { name: "Place simulated order" }).click();

    await expect(page).toHaveURL(/\/checkout\/confirmation$/);
    const confirmation = page.locator("[data-testid=order-confirmation]:visible");
    await expect(confirmation.getByTestId("order-number")).toHaveText(/^MM-\d{6}$/);
    await expect(confirmation.getByTestId("order-line")).toHaveText(
      /Glass Pantry Jar · 1 L × 2 at \$18\.00\s*\$36\.00/,
    );
    await expect(confirmation.getByTestId("order-total")).toHaveText("$44.00");
    await expect(confirmation).toContainText("Portland, Oregon 97205");
    await expect(confirmation.getByTestId("simulated-order-notice")).toContainText(
      "No payment was taken",
    );
    await expect(page.getByTestId("header-cart")).toHaveAttribute("aria-label", "Cart 0 items");

    const orderNumber = await confirmation.getByTestId("order-number").textContent();
    expect(stockOf(JAR_1L)).toBe(stockBefore - 2);
    expect(orderCount()).toBe(ordersBefore + 1);
    const stored = query((db) =>
      db
        .prepare("SELECT is_simulated, total_minor, email FROM orders WHERE order_number = ?")
        .get(orderNumber),
    );
    expect(stored).toEqual({ is_simulated: 1, total_minor: 4400, email: "avery@example.com" });

    // The confirmation survives a reload in the same browser.
    await page.reload();
    await expect(page.getByTestId("order-number")).toHaveText(orderNumber ?? "");
  });

  test("invalid details show field errors and create no order", async ({ page }) => {
    const ordersBefore = orderCount();
    await addToCart(page, `/products/cedar-drawer-blocks`, 1);
    await page.goto("/checkout");

    const form = checkoutForm(page);
    await form.getByLabel("Email", { exact: true }).fill("not-an-email");
    await form.getByLabel("ZIP code").fill("123");
    await form.getByRole("button", { name: "Place simulated order" }).click();

    await expect(form.getByRole("alert")).toContainText("Please correct the highlighted fields.");
    await expect(form.getByLabel("Email", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(form).toContainText("Enter a valid email address.");
    await expect(form).toContainText("Enter a 5-digit ZIP code (or ZIP+4).");
    await expect(form).toContainText("Choose a state.");
    await expect(form).toContainText("Please confirm you understand this is a simulated order.");
    // What the shopper typed is kept.
    await expect(form.getByLabel("Email", { exact: true })).toHaveValue("not-an-email");
    expect(orderCount()).toBe(ordersBefore);
  });

  test("stock that sells out during checkout is rejected without an order", async ({ page }) => {
    const ordersBefore = orderCount();
    const original = stockOf(CEDAR);
    await addToCart(page, `/products/cedar-drawer-blocks`, 2);
    await page.goto("/checkout");
    await fillShipping(page);

    setStock(CEDAR, 0);
    try {
      await checkoutForm(page).getByRole("button", { name: "Place simulated order" }).click();
      const alert = checkoutForm(page).getByRole("alert");
      await expect(alert).toContainText(
        "Some items in your cart changed. Please review your cart and try again.",
      );
      await expect(alert).toContainText("Cedar Drawer Blocks (Set of 8) has sold out.");
      expect(orderCount()).toBe(ordersBefore);
      expect(stockOf(CEDAR)).toBe(0);

      // The cart now flags the item and offers no checkout until it is fixed.
      await page.goto("/cart");
      await expect(page.getByText("Please update or remove the items marked above")).toBeVisible();
      await expect(page.getByRole("link", { name: "Continue to checkout" })).toHaveCount(0);
    } finally {
      setStock(CEDAR, original);
    }
  });

  test("confirmation without a recent order explains itself", async ({ page }) => {
    await page.goto("/checkout/confirmation");
    await expect(
      page.getByRole("heading", { name: "We couldn’t find a recent order." }),
    ).toBeVisible();
  });
});
