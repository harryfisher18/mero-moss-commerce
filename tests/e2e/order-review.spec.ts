import { expect, type Page, test } from "@playwright/test";
import { addToCart, checkout, query, signInAsMerchant, visible } from "./helpers";

// Plenty of stock, and not used by the stock-sensitive specs.
const PLATE_PATH = "/products/stoneware-dinner-plate?variant=var_mm-tk-sdp-chk";

async function placeProcessedOrder(page: Page, quantity: number): Promise<string> {
  await addToCart(page, PLATE_PATH, quantity);
  const orderNumber = await checkout(page);
  await expect
    .poll(() =>
      query(
        (db) =>
          db.prepare("SELECT status FROM outbox_events WHERE subject = ?").get(orderNumber)?.status,
      ),
    )
    .toBe("succeeded");
  return orderNumber;
}

const queueRow = (page: Page, orderNumber: string) =>
  page.locator(`[data-testid=order-row][data-order-number="${orderNumber}"]:visible`);

test.describe("order review queue and fulfillment preview", () => {
  test("a flagged order is held until a person clears it", async ({ page }) => {
    const orderNumber = await placeProcessedOrder(page, 5);

    await signInAsMerchant(page, "/admin/orders");
    await page
      .getByRole("link", { name: /^Needs review/ })
      .locator("visible=true")
      .click();
    await expect(page).toHaveURL(/view=review$/);
    await queueRow(page, orderNumber).getByRole("link", { name: orderNumber }).click();

    const review = visible(page, "order-review");
    await expect(review).toContainText("Review: bulk quantity");
    await expect(page.getByRole("button", { name: "Start processing" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Cancel order" }).locator("visible=true"),
    ).toBeVisible();

    const preview = visible(page, "fulfillment-preview");
    await expect(preview.getByTestId("fulfillment-readiness")).toHaveText("Held for review");
    await expect(preview).toContainText("MM-TK-SDP-CHK");
    await expect(preview).toContainText("Portland, OR");
    await expect(preview).toContainText("Nothing is sent to a warehouse");
    await expect(preview).not.toContainText("Avery");

    await review.getByRole("button", { name: "Mark as reviewed" }).click();
    await expect(review).toContainText("Reviewed by merchant@meroandmoss.example");
    await expect(preview.getByTestId("fulfillment-readiness")).toHaveText("Ready to start");
    await page.getByRole("button", { name: "Start processing" }).locator("visible=true").click();
    await expect(preview.getByTestId("fulfillment-readiness")).toHaveText("Being prepared");

    await page.goto("/admin/orders?view=review");
    await expect(queueRow(page, orderNumber)).toHaveCount(0);
  });

  test("an unflagged order skips the queue and can be processed", async ({ page }) => {
    const orderNumber = await placeProcessedOrder(page, 1);

    await signInAsMerchant(page, "/admin/orders?view=review");
    await expect(queueRow(page, orderNumber)).toHaveCount(0);

    await page.goto("/admin/orders");
    await queueRow(page, orderNumber).getByRole("link", { name: orderNumber }).click();
    await expect(visible(page, "order-review")).toHaveCount(0);
    await expect(
      visible(page, "fulfillment-preview").getByTestId("fulfillment-readiness"),
    ).toHaveText("Ready to start");
    await expect(
      page.getByRole("button", { name: "Start processing" }).locator("visible=true"),
    ).toBeVisible();
  });
});
