import { expect, type Page, test } from "@playwright/test";
import { addToCart, checkout, query, signInAsMerchant, visible } from "./helpers";

const PLATE_PATH = "/products/stoneware-dinner-plate?variant=var_mm-tk-sdp-chk";

const uniqueEmail = (label: string) =>
  `${label}-${test.info().project.name}-${Date.now()}@example.com`.toLowerCase();

const eventOf = (orderNumber: string) =>
  query(
    (db) =>
      db.prepare("SELECT id, status FROM outbox_events WHERE subject = ?").get(orderNumber) as
        { id: string; status: string } | undefined,
  );

const processed = (orderNumber: string) =>
  expect.poll(() => eventOf(orderNumber)?.status).toBe("succeeded");

const recordsFor = (reference: string) =>
  query((db) =>
    db
      .prepare("SELECT journey, email, status FROM lifecycle_messages WHERE reference = ?")
      .all(reference)
      .map((row) => ({ ...row })),
  );

const message = (page: Page, journey: string, reference: string) =>
  page.locator(
    `[data-testid=lifecycle-message][data-journey=${journey}][data-reference="${reference}"]:visible`,
  );

test.describe("consent-gated lifecycle journeys", () => {
  test("is merchant-only", async ({ page }) => {
    const response = await page.request.get("/admin/lifecycle", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/admin/login?next=");
  });

  test("an order without the opt-in prepares nothing and stores no email", async ({ page }) => {
    const email = uniqueEmail("noconsent");
    await addToCart(page, PLATE_PATH, 1);
    const orderNumber = await checkout(page, { email });
    await processed(orderNumber);

    expect(recordsFor(orderNumber)).toEqual([
      { journey: "post_purchase", email: null, status: "skipped_no_consent" },
    ]);
    expect(
      query((db) =>
        db.prepare("SELECT COUNT(*) AS n FROM marketing_consents WHERE email = ?").get(email),
      )?.n,
    ).toBe(0);
  });

  test("the opt-in starts journeys, replay adds nothing, and withdrawal stops them", async ({
    page,
  }) => {
    const email = uniqueEmail("optin");
    await addToCart(page, PLATE_PATH, 1);
    const orderNumber = await checkout(page, { email, marketingConsent: true });
    await processed(orderNumber);

    await signInAsMerchant(page, "/admin/lifecycle");
    await expect(visible(page, "lifecycle-disclaimer")).toContainText("Previews only.");
    const postPurchase = message(page, "post_purchase", orderNumber);
    await expect(postPurchase).toContainText("Preview only · not sent");
    await expect(postPurchase).toContainText(`Thank you for your order ${orderNumber}`);
    await expect(postPurchase).toContainText("1 × Stoneware Dinner Plate (Chalk)");
    await expect(postPurchase).not.toContainText(email);

    // Replaying the same event through the job log does not repeat the journey.
    const before = recordsFor(orderNumber);
    await page.goto(`/admin/automations/${eventOf(orderNumber)?.id ?? ""}`);
    await visible(page, "event-detail").getByRole("button", { name: "Replay event" }).click();
    await expect(visible(page, "event-action-status")).toContainText("Replayed.");
    expect(recordsFor(orderNumber)).toEqual(before);

    // Withdrawing consent stops the next order's journey.
    await page.goto("/admin/lifecycle");
    const consent = page.locator(`[data-testid=consent][data-email="${email}"]:visible`);
    await consent.getByRole("button", { name: /Withdraw consent/ }).click();
    await expect(consent).toHaveAttribute("data-status", "withdrawn");

    await addToCart(page, PLATE_PATH, 1);
    const nextOrder = await checkout(page, { email });
    await processed(nextOrder);
    expect(recordsFor(nextOrder)).toEqual([
      { journey: "post_purchase", email: null, status: "skipped_no_consent" },
    ]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test("a cart reminder needs consent, previews after an hour, and only once", async ({
    page,
    context,
  }) => {
    const email = uniqueEmail("cart");
    await addToCart(page, PLATE_PATH, 2);
    await page.goto("/cart");
    const form = visible(page, "cart-reminder");
    const status = form.getByTestId("cart-reminder-status");

    await expect(form.getByRole("checkbox")).not.toBeChecked();
    await form.getByLabel("Email for a reminder").fill(email);
    await form.getByRole("button", { name: "Remind me" }).click();
    await expect(status).toHaveText("Please correct the highlighted fields.");
    await expect(form).toContainText("Please tick the box");
    expect(
      query((db) =>
        db.prepare("SELECT COUNT(*) AS n FROM marketing_consents WHERE email = ?").get(email),
      )?.n,
    ).toBe(0);

    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "Remind me" }).click();
    await expect(status).toContainText("does not send email");

    // Age this test's cart past the abandonment window.
    const cartId = (await context.cookies()).find((c) => c.name === "mm_cart")?.value ?? "";
    query((db) =>
      db
        .prepare("UPDATE carts SET updated_at = '2026-01-01T00:00:00.000Z' WHERE id = ?")
        .run(cartId),
    );

    await signInAsMerchant(page, "/admin/lifecycle");
    const sweep = page
      .getByRole("button", { name: "Check for abandoned carts" })
      .locator("visible=true");
    await sweep.click();
    await expect(visible(page, "sweep-status")).toHaveText(/^1 previewed, 0 skipped\.$/);
    await sweep.click();
    await expect(visible(page, "sweep-status")).toHaveText("No carts need a reminder.");

    const reminders = query((db) =>
      db
        .prepare("SELECT body, delivery FROM lifecycle_messages WHERE dedupe_key LIKE ?")
        .all(`abandoned_cart:${cartId}:%`)
        .map((row) => ({ ...row })),
    );
    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({ delivery: "preview_only" });
    expect(String(reminders[0]?.body)).toContain("2 × Stoneware Dinner Plate (Chalk)");
  });
});
