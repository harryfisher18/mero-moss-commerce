import { expect, test } from "@playwright/test";
import { query, signInAsMerchant, visible } from "./helpers";

const STAND = "prod_oak-monitor-stand";
const SEEDED = {
  title: "Oak Monitor Stand",
  summary: "Raises the screen to eye level and frees space underneath.",
};
const FIXED_SUMMARY =
  "A solid oak monitor stand that raises the screen to eye level and frees space underneath.";

/** Restores the seeded copy and clears drafts so both browser projects start alike. */
function restoreStand() {
  query((db) => {
    db.prepare("UPDATE products SET title = ?, summary = ?, seo_description = '' WHERE id = ?").run(
      SEEDED.title,
      SEEDED.summary,
      STAND,
    );
    db.prepare("DELETE FROM content_drafts WHERE product_id = ?").run(STAND);
  });
}

const approvedSeo = () =>
  query(
    (db) =>
      db
        .prepare(
          "SELECT seo_description AS seo FROM content_drafts WHERE product_id = ? AND status = 'approved'",
        )
        .get(STAND) as { seo: string },
  ).seo;

/**
 * Journey 4 steps 2–4: the merchant generates a content proposal (rules-based without an
 * AI key), inspects the factual checks and diff, and approves it; the storefront then shows
 * the new copy and the change history records it.
 */
test("Journey 4b: content draft → factual checks → approval → storefront with audit", async ({
  page,
}) => {
  restoreStand();
  try {
    await signInAsMerchant(page, `/admin/products/${STAND}`);
    await page.getByRole("link", { name: "Content Studio" }).locator("visible=true").click();
    await expect(page).toHaveURL(new RegExp(`/admin/products/${STAND}/content$`));
    await expect(visible(page, "drafting-mode")).toContainText(
      "Rules-based drafts: no AI key is configured",
    );

    // Generate: a labelled rules-based draft that passes every check and touches nothing.
    await page
      .getByRole("button", { name: "Generate a new draft" })
      .locator("visible=true")
      .click();
    const draft = visible(page, "latest-draft");
    await expect(draft.getByRole("heading", { name: "Draft v1" })).toBeVisible();
    await expect(draft.getByTestId("draft-source")).toHaveText("Rules-based draft");
    // The studio fits phone screens (no horizontal page scroll).
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(draft.getByTestId("constraint-checks")).toContainText("All factual checks pass");
    await expect(draft.locator("[data-field=seoDescription] ins")).toContainText(
      "Oak Monitor Stand: Raises the screen to eye level",
    );
    await expect(draft.locator("[data-field=seoDescription] ins")).toContainText(
      "Made with FSC-certified solid oak",
    );

    // An edit that invents facts is saved as a new version but cannot be approved.
    await draft
      .getByLabel(/^Summary/)
      .fill("The best walnut monitor stand, now $59 with a 10-year warranty.");
    await draft.getByRole("button", { name: "Save as new version" }).click();
    await expect(draft.getByRole("heading", { name: "Draft v2" })).toBeVisible();
    await expect(draft.getByTestId("draft-source")).toHaveText("Edited by merchant");
    const violations = draft.getByTestId("violations");
    await expect(violations).toContainText("Summary claims “best”");
    await expect(violations).toContainText("Summary mentions “walnut”");
    await expect(violations).toContainText("Summary mentions a price");
    await expect(violations).toContainText("Summary states “10”");
    await expect(violations).toContainText("Summary claims “warranty”");
    await expect(draft.getByRole("button", { name: "Approve and publish" })).toHaveCount(0);

    // Fixing the copy makes approval available; approving publishes to the demo catalog.
    await draft.getByLabel(/^Summary/).fill(FIXED_SUMMARY);
    await draft.getByRole("button", { name: "Save as new version" }).click();
    await expect(draft.getByRole("heading", { name: "Draft v3" })).toBeVisible();
    await expect(draft.getByTestId("constraint-checks")).toContainText("All factual checks pass");
    // Word-level diff: the old opening word is struck, the new words are marked as added.
    await expect(draft.locator("[data-field=summary] del").first()).toHaveText("Raises");
    await expect(draft.locator("[data-field=summary] ins").last()).toContainText(
      "solid oak monitor stand",
    );
    await draft.getByRole("button", { name: "Approve and publish" }).click();
    await expect(visible(page, "approved-notice")).toContainText("published to the demo catalog");
    await expect(visible(page, "draft-versions").locator("li")).toHaveCount(3);

    // The storefront shows the approved copy and uses the SEO description as meta.
    await page.goto("/products/oak-monitor-stand");
    await expect(visible(page, "product-detail")).toContainText(FIXED_SUMMARY);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      approvedSeo(),
    );

    // The product's change history records who approved which draft.
    await page.goto(`/admin/products/${STAND}`);
    await expect(page.locator("main")).toContainText("(Content Studio, draft v3)");

    // A further draft can be rejected without changing the live copy.
    await page.goto(`/admin/products/${STAND}/content`);
    await page
      .getByRole("button", { name: "Generate a new draft" })
      .locator("visible=true")
      .click();
    const next = visible(page, "latest-draft");
    await expect(next.getByRole("heading", { name: "Draft v4" })).toBeVisible();
    await next.getByRole("button", { name: "Reject draft" }).click();
    await expect(next).toHaveAttribute("data-status", "rejected");
    await page.goto("/products/oak-monitor-stand");
    await expect(visible(page, "product-detail")).toContainText(FIXED_SUMMARY);
  } finally {
    restoreStand();
  }
});

test("Content Studio requires a merchant session", async ({ page }) => {
  const response = await page.request.get(`/admin/products/${STAND}/content`, {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/admin/login?next=");
});
