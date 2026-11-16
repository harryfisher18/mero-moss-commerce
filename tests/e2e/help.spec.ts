import { expect, test } from "@playwright/test";
import { query } from "./helpers";

const storedPolicy = (key: string) =>
  query((db) => String(db.prepare("SELECT body FROM store_policies WHERE key = ?").get(key)?.body));

test.describe("Help & FAQ", () => {
  test("is linked from the header and footer", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Help" })
      .click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByRole("heading", { level: 1, name: "Help & FAQ" })).toBeVisible();
    await expect(
      page.getByRole("contentinfo").getByRole("link", { name: "Help & FAQ" }),
    ).toHaveAttribute("href", "/help");
  });

  test("policy answers quote the stored policies and every link works", async ({ page }) => {
    await page.goto("/help");
    const entries = page.getByTestId("faq-entry");
    await expect(entries).toHaveCount(7);

    // Answers are closed until opened, and open with the keyboard.
    const returns = page.locator("#faq-returns");
    await expect(returns.getByText(storedPolicy("returns"))).toBeHidden();
    await returns.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(returns.getByText(storedPolicy("returns"), { exact: true })).toBeVisible();
    await expect(returns).toContainText("From our published store policy.");
    await returns.getByRole("link", { name: "Returns policy" }).click();
    await expect(page).toHaveURL(/\/#returns$/);

    for (const key of ["shipping", "care-and-warranty", "demo-store"]) {
      await page.goto("/help");
      const entry = page.locator(`#faq-${key}`);
      await entry.locator("summary").click();
      await expect(entry.getByText(storedPolicy(key), { exact: true })).toBeVisible();
    }

    await page.goto("/help");
    const person = page.locator("#faq-reach-a-person");
    await person.locator("summary").click();
    await person.getByRole("link", { name: "Talk to a person" }).click();
    await expect(page).toHaveURL(/\/advisor#talk-to-a-person$/);
    await expect(page.getByRole("heading", { name: "Talk to a person" })).toBeVisible();

    await page.goto("/help");
    const choosing = page.locator("#faq-choosing");
    await choosing.locator("summary").click();
    await choosing.getByRole("link", { name: "Ask an advisor" }).click();
    await expect(page).toHaveURL(/\/advisor$/);

    // The privacy answer has nowhere to send the shopper, so it shows no link.
    await page.goto("/help");
    const privacy = page.locator("#faq-privacy");
    await privacy.locator("summary").click();
    await expect(privacy).toContainText("Global Privacy Control");
    await expect(privacy.getByRole("link")).toHaveCount(0);
  });
});
