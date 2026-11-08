import { DatabaseSync } from "node:sqlite";
import { expect, type Page } from "@playwright/test";

/** Same isolated database the E2E web server uses (see playwright.config.ts). */
export const E2E_DB_PATH = ".data/e2e.db";
export const DEMO_MERCHANT = { email: "merchant@meroandmoss.example", password: "moss-demo-2026" };

export function query<T>(fn: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(E2E_DB_PATH);
  // The app writes in the background (analytics beacons), so wait as the server does.
  db.exec("PRAGMA busy_timeout = 5000;");
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

export const stockOf = (variantId: string) =>
  query((db) =>
    Number(
      db.prepare("SELECT inventory_quantity AS q FROM variants WHERE id = ?").get(variantId)?.q,
    ),
  );

export const visible = (page: Page, testId: string) =>
  page.locator(`[data-testid=${testId}]:visible`);

export async function addToCart(page: Page, path: string, quantity: number) {
  await page.goto(path);
  const form = visible(page, "add-to-cart");
  await form.getByLabel("Quantity").fill(String(quantity));
  await form.getByRole("button", { name: "Add to cart" }).click();
  await expect(form.getByRole("status")).toContainText("Added to your cart.");
}

/** Completes the demo checkout from a non-empty cart and returns the order number. */
export async function checkout(
  page: Page,
  options: { email?: string; marketingConsent?: boolean } = {},
): Promise<string> {
  await page.goto("/checkout");
  const form = visible(page, "checkout-form");
  await form.getByLabel("Email", { exact: true }).fill(options.email ?? "avery@example.com");
  await form.getByLabel("Full name").fill("Avery Stone");
  await form.getByLabel("Address", { exact: true }).fill("12 Elm Street");
  await form.getByLabel("City").fill("Portland");
  await form.getByLabel("State").selectOption("OR");
  await form.getByLabel("ZIP code").fill("97205");
  if (options.marketingConsent) await form.getByLabel(/Email me about new pieces/).check();
  await form.getByLabel(/I understand this is a simulated order/).check();
  await form.getByRole("button", { name: "Place simulated order" }).click();
  await expect(page).toHaveURL(/\/checkout\/confirmation$/);
  const number = await visible(page, "order-number").textContent();
  if (!number) throw new Error("No order number on confirmation page");
  return number;
}

export async function signInAsMerchant(page: Page, path = "/admin/orders") {
  await page.goto(path);
  await expect(page).toHaveURL(/\/admin\/login/);
  const form = visible(page, "login-form");
  await form.getByLabel("Email").fill(DEMO_MERCHANT.email);
  await form.getByLabel("Password").fill(DEMO_MERCHANT.password);
  await form.getByRole("button", { name: "Sign in" }).click();
  // Wait for the post-login redirect so the session cookie exists before the next step.
  await expect(page).not.toHaveURL(/\/admin\/login/);
}
