import { expect, test } from "@playwright/test";
import { addToCart, checkout, DEMO_MERCHANT, signInAsMerchant, stockOf, visible } from "./helpers";

const JAR_2L = "var_mm-tk-gpj-20"; // Glass Pantry Jar, 2 L

test.describe("merchant console", () => {
  test("signed-out visitors are redirected to login before anything renders", async ({ page }) => {
    const response = await page.request.get("/admin/orders", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("/admin/login?next=%2Fadmin%2Forders");

    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Forders$/);
    await expect(page.getByTestId("demo-email")).toHaveText(DEMO_MERCHANT.email);
  });

  test("wrong credentials are rejected; sign in and out works", async ({ page }) => {
    await page.goto("/admin/login");
    const form = visible(page, "login-form");
    await form.getByLabel("Email").fill(DEMO_MERCHANT.email);
    await form.getByLabel("Password").fill("not-the-password");
    await form.getByRole("button", { name: "Sign in" }).click();
    await expect(form.getByRole("alert")).toHaveText(
      "That email and password combination is not recognized.",
    );

    await signInAsMerchant(page);
    await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
    // The console header must fit the viewport (no horizontal page scroll on phones).
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeInViewport();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("status moves through the lifecycle with history; cancelling restocks", async ({ page }) => {
    // Order A: placed → processing → fulfilled
    await addToCart(page, `/products/glass-pantry-jar?variant=${JAR_2L}`, 1);
    const first = await checkout(page);
    // Order B: placed → cancelled (returns stock)
    await addToCart(page, `/products/glass-pantry-jar?variant=${JAR_2L}`, 2);
    const second = await checkout(page);
    const stockAfterOrders = stockOf(JAR_2L);

    await signInAsMerchant(page);
    const open = async (orderNumber: string) => {
      await page.goto("/admin/orders");
      await page.getByRole("link", { name: orderNumber, exact: true }).click();
      return visible(page, "admin-order-detail");
    };

    let order = await open(first);
    await expect(order.getByRole("button", { name: "Mark fulfilled (simulated)" })).toHaveCount(0);
    await order.getByRole("button", { name: "Start processing" }).click();
    await expect(order.getByTestId("order-status")).toHaveText("Processing");
    await order.getByRole("button", { name: "Mark fulfilled (simulated)" }).click();
    await expect(order.getByTestId("order-status")).toHaveText("Fulfilled (simulated)");
    await expect(order).toContainText("This order is closed. No further changes.");
    await expect(order.getByTestId("order-history").getByRole("listitem")).toHaveCount(3);
    await expect(order.getByTestId("order-history")).toContainText(DEMO_MERCHANT.email);

    order = await open(second);
    await order.getByRole("button", { name: "Cancel order" }).click();
    await expect(order.getByTestId("order-status")).toHaveText("Cancelled");
    expect(stockOf(JAR_2L)).toBe(stockAfterOrders + 2);

    await page.goto("/admin/orders?status=cancelled");
    await expect(
      page.locator(`[data-testid=order-row][data-order-number="${second}"]`),
    ).toBeVisible();
    await expect(page.locator(`[data-testid=order-row][data-order-number="${first}"]`)).toHaveCount(
      0,
    );
  });
});
