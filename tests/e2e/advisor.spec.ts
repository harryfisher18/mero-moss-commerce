import { expect, test } from "@playwright/test";
import { query, signInAsMerchant, visible } from "./helpers";

const usd = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);

const variantRow = (variantId: string) =>
  query(
    (db) =>
      db
        .prepare("SELECT price_minor, inventory_quantity FROM variants WHERE id = ?")
        .get(variantId) as { price_minor: number; inventory_quantity: number },
  );

const ask = async (page: import("@playwright/test").Page, question: string) => {
  await page.goto("/advisor");
  const form = visible(page, "advisor-form");
  await form.getByLabel("Your question").fill(question);
  await form.getByRole("button", { name: "Ask" }).click();
  // The exact question must arrive: typing before streaming finishes must not be lost.
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(question);
  const answer = visible(page, "advisor-answer");
  await expect(answer.getByTestId("advisor-question")).toHaveText(`You asked: “${question}”`);
  return answer;
};

const storedPolicy = (key: string) =>
  query(
    (db) =>
      db.prepare("SELECT body FROM store_policies WHERE key = ?").get(key) as { body: string },
  ).body;

test.describe("shopping advisor", () => {
  test("recommends in-stock variants within budget at their exact current prices", async ({
    page,
  }) => {
    const answer = await ask(page, "travel gifts under $50");
    await expect(answer.getByTestId("advisor-source")).toHaveText(
      "Built directly from our live catalog and published policies.",
    );
    const cards = answer.getByTestId("advisor-card");
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const card = cards.nth(index);
      const variantId = (await card.getAttribute("data-variant-id")) ?? "";
      const row = variantRow(variantId);
      expect(row.price_minor).toBeLessThanOrEqual(5000);
      expect(row.inventory_quantity).toBeGreaterThan(0);
      await expect(card.getByTestId("advisor-card-price")).toContainText(usd(row.price_minor));
      await expect(card).toContainText("In Travel Essentials");
    }

    // The card links to the exact variant, and the product page shows the same price.
    const first = cards.first();
    const variantId = (await first.getAttribute("data-variant-id")) ?? "";
    await first.getByRole("heading").getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`variant=${variantId}$`));
    await expect(visible(page, "product-detail").getByTestId("product-price")).toContainText(
      usd(variantRow(variantId).price_minor),
    );
  });

  test("is honest about sold-out items, policies and discounts", async ({ page }) => {
    let answer = await ask(page, "linen storage bin in moss");
    await expect(answer.getByTestId("advisor-notes")).toContainText(
      "Linen Storage Bin (Moss) is sold out right now.",
    );
    await expect(answer.locator("[data-variant-id=var_mm-ho-lsb-mos]")).toHaveCount(0);

    answer = await ask(page, "What is your return policy?");
    await expect(
      answer.locator("[data-testid=advisor-policy][data-key=returns] blockquote"),
    ).toHaveText(storedPolicy("returns"));

    answer = await ask(page, "Do you have a discount code?");
    await expect(answer.getByTestId("advisor-notes")).toContainText(
      "I can't see any discount codes in our store",
    );

    // Extra words do not stop the advisor from quoting the stored policy verbatim.
    answer = await ask(page, "Is there a lifetime warranty?");
    await expect(
      answer.locator("[data-testid=advisor-policy][data-key=care-and-warranty] blockquote"),
    ).toHaveText(storedPolicy("care-and-warranty"));
    await expect(answer.getByTestId("advisor-card")).toHaveCount(0);
  });

  test("a shopper can reach a person, and the merchant sees the request", async ({ page }) => {
    const message = `Can the weekender fit a 16-inch laptop? (${test.info().project.name} ${Date.now()})`;
    const answer = await ask(page, "Can I talk to a person?");
    await expect(answer.getByTestId("advisor-lead")).toContainText("I'll pass this to our team");

    const form = visible(page, "support-form");
    await form.getByLabel("Email").fill("not-an-email");
    await form.getByLabel("How can we help?").fill(message);
    await form.getByRole("button", { name: "Send to our team" }).click();
    await expect(form.getByTestId("support-status")).toHaveText(
      "Please correct the highlighted fields.",
    );
    await expect(form.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
    await expect(form.getByLabel("How can we help?")).toHaveValue(message);

    await form.getByLabel("Email").fill("avery@example.com");
    await form.getByRole("button", { name: "Send to our team" }).click();
    await expect(visible(page, "support-status")).toHaveText(
      "Thank you. Your question is with our team.",
    );
    expect(
      query((db) =>
        db.prepare("SELECT question FROM support_requests WHERE message = ?").get(message),
      ),
    ).toEqual({ question: "Can I talk to a person?" });

    await signInAsMerchant(page, "/admin/support");
    await expect(visible(page, "advisor-state")).toHaveText("Demo · catalog answers only");
    const request = page.locator("[data-testid=support-request]:visible", { hasText: message });
    await expect(request).toContainText("avery@example.com");
    await expect(request).toContainText("Asked the advisor: “Can I talk to a person?”");
  });

  test("is reachable from the header and from product pages", async ({ page }) => {
    await page.goto("/products/brass-task-lamp");
    await page
      .getByRole("link", { name: "Ask our shopping advisor" })
      .locator("visible=true")
      .click();
    await expect(page).toHaveURL(/\/advisor\?q=Brass%20Task%20Lamp$/);
    await expect(
      visible(page, "advisor-card").getByRole("heading", { name: "Brass Task Lamp" }),
    ).toBeVisible();

    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Primary" })
      .locator("visible=true")
      .getByRole("link", { name: "Ask an advisor" })
      .click();
    await expect(page).toHaveURL(/\/advisor$/);
    await expect(
      page.getByRole("heading", { name: "Shopping advisor" }).locator("visible=true"),
    ).toBeVisible();
  });
});
