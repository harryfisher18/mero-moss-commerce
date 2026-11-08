import { expect, test } from "@playwright/test";
import { addToCart, checkout, query, signInAsMerchant, visible } from "./helpers";

const BIN = "linen-storage-bin"; // Oat in stock at $28.00; Moss sold out

const cartLineCount = () =>
  query((db) => Number(db.prepare("SELECT COUNT(*) AS n FROM cart_lines").get()?.n));

test.describe("Upgrade Lab", () => {
  test("is merchant-only", async ({ page }) => {
    const response = await page.request.get("/admin/upgrade-lab", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/admin/login?next=");
  });

  test("product page: same product both ways, labelled, measured live, no real cart", async ({
    page,
  }) => {
    await signInAsMerchant(page, "/admin/upgrade-lab");
    await page.goto(`/admin/upgrade-lab?product=${BIN}`);
    await expect(visible(page, "lab-disclaimer")).toContainText("Illustrative, not measured.");
    const linesBefore = cartLineCount();

    // Before: one "from" price, and a sold-out choice only fails after pressing Add.
    const before = visible(page, "lab-before");
    await expect(before.getByTestId("lab-before-price")).toHaveText("From $28.00");
    await before.getByLabel("Option").selectOption({ label: "Moss" });
    await expect(before.getByTestId("lab-before-price")).toHaveText("From $28.00");
    await before.getByRole("button", { name: "Add" }).click();
    await expect(before.getByTestId("lab-before-message")).toHaveText(
      "Sorry, there was a problem. Please try again.",
    );

    // After: selecting the sold-out option says so before any attempt to buy.
    const after = visible(page, "lab-after");
    await expect(after.getByTestId("lab-after-availability")).toHaveText("In stock");
    await after.getByRole("button", { name: "Moss (sold out)" }).click();
    await expect(after.getByTestId("lab-after-availability")).toHaveText("Sold out");
    await expect(after.getByRole("button", { name: "Sold out", exact: true })).toBeDisabled();

    await after.getByRole("button", { name: "Oat" }).click();
    await after.getByRole("button", { name: "Add to cart" }).click();
    await expect(after.getByTestId("lab-after-message")).toHaveText(
      "Preview only: nothing was added to a cart.",
    );
    expect(cartLineCount()).toBe(linesBefore);

    // Measurements appear only on request and match what is actually rendered.
    await expect(visible(page, "lab-measurements")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Measure these panels" })
      .locator("visible=true")
      .click();
    const table = visible(page, "lab-measurements");
    await expect(table).toContainText("Read from the panels above just now");
    const smallest = (panel: string) =>
      page.evaluate((id) => {
        const heights = [
          ...document.querySelectorAll(
            `[data-testid=${id}] a, [data-testid=${id}] button, [data-testid=${id}] select, [data-testid=${id}] input`,
          ),
        ]
          .filter((element) => (element as HTMLElement).offsetParent !== null)
          .map((element) => element.getBoundingClientRect().height);
        return Math.round(Math.min(...heights));
      }, panel);
    const beforePx = await smallest("lab-before");
    const afterPx = await smallest("lab-after");
    await expect(table.getByTestId("lab-smallest-before")).toHaveText(`${beforePx} px`);
    await expect(table.getByTestId("lab-smallest-after")).toHaveText(`${afterPx} px`);

    // No invented results anywhere on the page, and it fits phone screens.
    await expect(page.locator("main")).not.toContainText(/\d+\s?%/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test("discovery: the same question through title search and the advisor", async ({ page }) => {
    await signInAsMerchant(page, "/admin/upgrade-lab");
    await page.goto("/admin/upgrade-lab?lab=discovery");
    const form = visible(page, "lab-search");
    await form.getByLabel("Shopper question").fill("Travel gifts under $50");
    await form.getByRole("button", { name: "Compare" }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"))
      .toBe("Travel gifts under $50");

    await expect(visible(page, "lab-before")).toContainText("0 results found.");
    const after = visible(page, "lab-after");
    await expect(after.getByTestId("lab-advisor-lead")).toContainText("in Travel Essentials");
    await expect(after.getByTestId("lab-advisor-card").first()).toBeVisible();
    await expect(after.getByTestId("lab-advisor-card").first()).toContainText("$");
  });

  test("orders: a real order as a note versus the automation rules", async ({ page }) => {
    await addToCart(page, "/products/linen-storage-bin?variant=var_mm-ho-lsb-oat", 5);
    const orderNumber = await checkout(page);
    await expect
      .poll(() =>
        query(
          (db) =>
            (
              db.prepare("SELECT status FROM outbox_events WHERE subject = ?").get(orderNumber) as
                { status: string } | undefined
            )?.status,
        ),
      )
      .toBe("succeeded");

    await signInAsMerchant(page, "/admin/upgrade-lab");
    await page.goto("/admin/upgrade-lab?lab=orders");
    await expect(
      page.getByRole("link", { name: orderNumber }).locator("visible=true"),
    ).toHaveAttribute("aria-current", "true");
    const note = visible(page, "lab-order-note");
    await expect(note).toContainText("5x Linen Storage Bin Oat");
    await expect(note).toContainText("a***@example.com");
    await expect(note).not.toContainText("avery@example.com");

    // A manual decision is checked against what the rules decide for this order.
    const triage = visible(page, "lab-triage");
    await triage.getByLabel("Ship zone").selectOption("east");
    await triage.getByLabel("Hold for review?").selectOption("no");
    await triage.getByRole("button", { name: "Check my decision" }).click();
    await expect(triage.getByTestId("lab-triage-feedback")).toHaveText(
      "The ship zone and review decision differ from the automation rules for this order.",
    );
    await triage.getByLabel("Ship zone").selectOption("west");
    await triage.getByLabel("Hold for review?").selectOption("yes");
    await triage.getByRole("button", { name: "Check my decision" }).click();
    await expect(triage.getByTestId("lab-triage-feedback")).toHaveText(
      "That matches the automation rules for this order.",
    );

    const after = visible(page, "lab-after");
    await expect(after.getByTestId("lab-order-tags")).toContainText("Ship zone: West");
    await expect(after.getByTestId("lab-order-tags")).toContainText("Review: bulk quantity");
    await expect(after).toContainText("Preview only, not sent");
    await after.getByRole("link", { name: "Open this order’s real job log" }).click();
    await expect(page).toHaveURL(/\/admin\/automations\/[0-9a-f-]{36}$/);
    await expect(visible(page, "event-detail").getByRole("heading", { level: 1 })).toHaveText(
      orderNumber,
    );
  });
});
