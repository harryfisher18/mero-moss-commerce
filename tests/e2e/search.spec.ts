import { expect, test } from "@playwright/test";
import { query, visible } from "./helpers";

const DRAFT = "prod_oak-wall-hook-rail";

test.describe("storefront search", () => {
  test("the header search finds products by name and links to them", async ({ page }) => {
    await page.goto("/collections/workspace");
    const search = visible(page, "header-search");
    await search.getByLabel("Search the shop").fill("linen");
    await search.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/search\?q=linen$/);

    const results = visible(page, "search-results");
    await expect(results.getByRole("heading", { level: 2 })).toHaveText(
      /^\d+ results? for “linen”$/,
    );
    const cards = results.getByTestId("product-card");
    await expect(cards.first()).toBeVisible();
    // Title matches come first.
    await expect(cards.first().getByRole("heading")).toContainText("Linen");

    await cards.first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/products\//);
  });

  test("partial words work, and unpublished products never appear", async ({ page }) => {
    query((db) => db.prepare("UPDATE products SET status = 'draft' WHERE id = ?").run(DRAFT));
    try {
      await page.goto("/search?q=hook%20ra");
      await expect(visible(page, "search-empty")).toBeVisible();
      query((db) => db.prepare("UPDATE products SET status = 'active' WHERE id = ?").run(DRAFT));
      await page.goto("/search?q=hook%20ra");
      await expect(
        visible(page, "search-results").locator(
          "[data-testid=product-card][data-handle=oak-wall-hook-rail]",
        ),
      ).toBeVisible();
    } finally {
      query((db) => db.prepare("UPDATE products SET status = 'active' WHERE id = ?").run(DRAFT));
    }
  });

  test("no matches offers the advisor with the same words", async ({ page }) => {
    await page.goto("/search?q=velvet%20armchair");
    const empty = visible(page, "search-empty");
    await expect(empty).toContainText("Nothing in the shop matches that.");
    await empty.getByRole("link", { name: "Ask the shopping advisor" }).click();
    await expect(page).toHaveURL(/\/advisor\?q=velvet%20armchair$/);
  });

  test("an empty search explains what to do", async ({ page }) => {
    await page.goto("/search");
    await expect(visible(page, "search-prompt")).toContainText("Type what you’re looking for");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
