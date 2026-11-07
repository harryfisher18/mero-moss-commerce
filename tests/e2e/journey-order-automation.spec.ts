import { expect, test } from "@playwright/test";
import { addToCart, checkout, query, signInAsMerchant, visible } from "./helpers";

const BIN = "var_mm-ho-lsb-oat"; // Linen Storage Bin, Oat: $28.00, stock 30

const eventFor = (orderNumber: string) =>
  query((db) =>
    db
      .prepare("SELECT id, status FROM outbox_events WHERE subject = ? AND type = 'order.created'")
      .get(orderNumber),
  ) as { id: string; status: string } | undefined;

const effectCounts = (eventId: string) =>
  query((db) => ({
    previews: Number(
      db.prepare("SELECT COUNT(*) AS n FROM notification_previews WHERE event_id = ?").get(eventId)
        ?.n,
    ),
    tags: Number(
      db.prepare("SELECT COUNT(*) AS n FROM order_tags WHERE source_event_id = ?").get(eventId)?.n,
    ),
  }));

/**
 * Journey 3 from the product requirements: a new order emits a durable event, the worker
 * routes it and records notification previews, and replaying the same event ID does not
 * apply its effects twice.
 */
test("Journey 3: an order event is routed, previewed and replays idempotently", async ({
  page,
}) => {
  // Five units of one item triggers the bulk-quantity review rule.
  await addToCart(page, `/products/linen-storage-bin?variant=${BIN}`, 5);
  const orderNumber = await checkout(page);

  // The event is committed with the order and processed right after the checkout response.
  await expect.poll(() => eventFor(orderNumber)?.status).toBe("succeeded");
  const eventId = eventFor(orderNumber)?.id ?? "";
  expect(effectCounts(eventId)).toEqual({ previews: 2, tags: 2 });

  await signInAsMerchant(page, "/admin/automations");
  const row = page.locator(`[data-testid=event-row][data-subject="${orderNumber}"]:visible`);
  await expect(row.getByTestId("event-status")).toHaveText("Succeeded");
  await row.getByRole("link", { name: orderNumber }).click();

  const detail = visible(page, "event-detail");
  await expect(detail.getByTestId("event-id")).toHaveText(eventId);
  await expect(detail.getByTestId("event-tags")).toContainText("Ship zone: West");
  await expect(detail.getByTestId("event-tags")).toContainText("Review: bulk quantity");

  const confirmation = detail.locator(
    "[data-testid=notification-preview][data-kind=customer_confirmation]",
  );
  await expect(confirmation).toContainText("Preview only · not sent");
  await expect(confirmation).toContainText("a***@example.com");
  await expect(confirmation).toContainText(`Your Mero & Moss order ${orderNumber} is confirmed`);
  await expect(confirmation).toContainText("5 × Linen Storage Bin (Oat): $140.00");
  await expect(
    detail.locator("[data-testid=notification-preview][data-kind=merchant_review]"),
  ).toContainText("5 units of Linen Storage Bin");

  // The inspector masks personal data, and the street address never enters the event.
  const payload = detail.getByTestId("event-payload");
  await expect(payload).toContainText('"orderNumber": "' + orderNumber + '"');
  await expect(payload).toContainText("a***@example.com");
  await expect(payload).not.toContainText("avery@example.com");
  await expect(payload).not.toContainText("Stone");
  await expect(payload).not.toContainText("Elm Street");
  await expect(detail.getByTestId("attempt-log").getByRole("listitem")).toHaveCount(1);

  // Replaying the same event ID creates nothing new.
  await detail.getByRole("button", { name: "Replay event" }).click();
  await expect(detail.getByTestId("event-action-status")).toHaveText(
    "Replayed. No new effects: this event's tags and previews already exist.",
  );
  await expect(detail.getByTestId("attempt-log").getByRole("listitem")).toHaveCount(2);
  await expect(detail.locator("[data-testid=attempt-log] li").last()).toHaveAttribute(
    "data-outcome",
    "duplicate",
  );
  expect(effectCounts(eventId)).toEqual({ previews: 2, tags: 2 });

  // The order itself shows its routing and review tags.
  await detail.getByRole("link", { name: `Open order ${orderNumber}` }).click();
  const automation = visible(page, "order-automation");
  await expect(automation).toContainText("Review: bulk quantity");
  await expect(automation.getByTestId("event-status")).toHaveText("Succeeded");
});

test("Journey 3: failed jobs retry with backoff, then dead-letter for operator action", async ({
  page,
}) => {
  await signInAsMerchant(page, "/admin/automations");

  // Retry drill: fails twice, then recovers.
  await visible(page, "automation-controls")
    .getByRole("button", { name: "Start retry drill" })
    .click();
  await expect(page).toHaveURL(/\/admin\/automations\/[0-9a-f-]{36}$/);
  let detail = visible(page, "event-detail");
  await expect(detail.getByTestId("event-status")).toHaveText("Retry scheduled");
  await expect(detail.getByTestId("event-attempts")).toHaveText("1 of 5");
  await expect(detail.getByTestId("event-last-error")).toContainText("Simulated failure (drill)");

  const retry = () => detail.getByRole("button", { name: "Retry now" }).click();
  const actionStatus = () => detail.getByTestId("event-action-status");
  await retry();
  await expect(actionStatus()).toHaveText(
    "Attempt 2 failed. The next automatic attempt is in 20 s.",
  );
  await retry();
  await expect(actionStatus()).toHaveText("Attempt 3 succeeded.");
  await expect(detail.getByTestId("event-status")).toHaveText("Succeeded");
  await expect(detail.getByRole("button", { name: "Retry now" })).toHaveCount(0);

  // Dead-letter drill: always fails; after the fifth attempt it needs an operator.
  await page.goto("/admin/automations");
  await visible(page, "automation-controls")
    .getByRole("button", { name: "Start dead-letter drill" })
    .click();
  await expect(page).toHaveURL(/\/admin\/automations\/[0-9a-f-]{36}$/);
  detail = visible(page, "event-detail");
  await expect(detail.getByTestId("event-attempts")).toHaveText("1 of 5");
  for (const [attempt, delay] of [
    [2, "20 s"],
    [3, "40 s"],
    [4, "1 min 20 s"],
  ] as const) {
    await retry();
    await expect(actionStatus()).toHaveText(
      `Attempt ${attempt} failed. The next automatic attempt is in ${delay}.`,
    );
  }
  await retry();
  await expect(actionStatus()).toHaveText(
    "Attempt 5 failed. The event is in the dead letter queue.",
  );
  await expect(detail.getByTestId("event-status")).toHaveText("Dead letter");
  await expect(detail.getByTestId("dead-letter-notice")).toContainText(
    "Automatic retries stopped after 5 attempts.",
  );
  await expect(detail.locator("[data-testid=attempt-log] li").last()).toHaveAttribute(
    "data-outcome",
    "dead",
  );
  // The operator can still act on it.
  await expect(detail.getByRole("button", { name: "Retry now" })).toBeVisible();

  await page.goto("/admin/automations?status=dead");
  await expect(
    page.locator("[data-testid=event-row]:visible").first().getByTestId("event-status"),
  ).toHaveText("Dead letter");
});

test("automation console requires a merchant session", async ({ page }) => {
  const response = await page.request.get("/admin/automations", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/admin/login?next=");
});
