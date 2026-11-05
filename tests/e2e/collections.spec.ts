import { expect, type Page, test } from "@playwright/test";

// With Cache Components, Next keeps recently visited routes mounted but hidden (React
// <Activity>), so locators target the visible route only.
const cards = (page: Page) =>
  page.locator("[data-testid=collection-grid]:visible [data-testid=product-card]");
const resultCount = (page: Page) => page.locator("#results-heading:visible");
const openFilters = async (page: Page) => {
  const details = page.locator("details:visible", { hasText: "Filters" });
  if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open))) {
    await details.locator("summary").click();
  }
};

test.describe("collection browsing", () => {
  test("shopper reaches Shop all from the home page", async ({ page, isMobile }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Shop the collection" }).click();
    await expect(page).toHaveURL(/\/collections\/all$/);
    await expect(page.getByRole("heading", { level: 1, name: "Shop all" })).toBeVisible();
    await expect(resultCount(page)).toHaveText("28 products");
    await expect(cards(page)).toHaveCount(12);

    const pagination = page.getByRole("navigation", { name: "Pagination" });
    await pagination.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(pagination.getByRole("link", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    if (!isMobile) {
      await page
        .getByRole("navigation", { name: "Primary" })
        .getByRole("link", { name: "Workspace" })
        .click();
      await expect(page.getByRole("heading", { level: 1, name: "Workspace" })).toBeVisible();
      await expect(resultCount(page)).toHaveText("7 products");
    }
  });

  test("filter by option, sort by price, then remove the filter", async ({ page }) => {
    await page.goto("/collections/all");
    const filters = page.getByRole("group", { name: "Color" });
    await openFilters(page);
    await filters.getByLabel("Oat").check();

    await expect(page).toHaveURL(/color=Oat/);
    await expect(resultCount(page)).toHaveText("6 products");

    await page.getByLabel("Sort by").selectOption("price-asc");
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(page).toHaveURL(/color=Oat/);
    await expect(cards(page).first()).toHaveAttribute("data-handle", "waffle-tea-towels");
    await expect(cards(page).first()).toContainText("$24.00");
    await expect(cards(page).last()).toHaveAttribute("data-handle", "merino-travel-blanket");

    await page
      .getByRole("list", { name: "Active filters" })
      .getByRole("link", {
        name: /Color: Oat/,
      })
      .click();
    await expect(page).not.toHaveURL(/color=/);
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(resultCount(page)).toHaveText("28 products");
    // The panel collapses when no filters remain; the checkbox must reflect the URL.
    await openFilters(page);
    await expect(filters.getByLabel("Oat")).not.toBeChecked();
  });

  test("invalid params fall back safely and out-of-range pages clamp", async ({ page }) => {
    const response = await page.goto("/collections/all?sort=bogus&price=free&page=999");
    expect(response?.status()).toBe(200);
    await expect(resultCount(page)).toHaveText("28 products");
    await expect(
      page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: "Page 3" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByLabel("Sort by")).toHaveValue("featured");
  });

  test("shows an empty state with a way back", async ({ page }) => {
    await page.goto("/collections/travel-essentials?price=under-25");
    await expect(page.getByText("No products match these filters.")).toBeVisible();
    await page.getByRole("link", { name: "Clear all filters" }).click();
    await expect(page).toHaveURL(/\/collections\/travel-essentials$/);
    await expect(resultCount(page)).toHaveText("7 products");
  });

  test("unknown collections return a real 404", async ({ page }) => {
    const response = await page.goto("/collections/electronics");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "We couldn’t find that page." }),
    ).toBeVisible();
  });
});
