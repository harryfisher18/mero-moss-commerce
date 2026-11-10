import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { addToCart, query, signInAsMerchant } from "./helpers";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

interface Finding {
  readonly route: string;
  readonly rule: string;
  readonly impact: string | null | undefined;
  readonly targets: readonly string[];
  readonly detail: string;
}

/** Scans each route once its streamed content has arrived, and reports everything found. */
async function scan(page: Page, routes: readonly string[]): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const route of routes) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main").getByText(/^Loading\b/)).toHaveCount(0);
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    for (const violation of violations) {
      findings.push({
        route,
        rule: violation.id,
        impact: violation.impact,
        targets: violation.nodes.map((node) => node.target.join(" ")),
        detail: violation.nodes[0]?.failureSummary ?? "",
      });
    }
  }
  return findings;
}

const firstId = (sql: string) => query((db) => String(db.prepare(sql).get()?.id ?? ""));

test.describe("accessibility (axe, WCAG A and AA)", () => {
  test("storefront routes have no violations", async ({ page }) => {
    await addToCart(page, "/products/felt-desk-mat?variant=var_mm-ws-fdm-oat-m", 1);
    expect(
      await scan(page, [
        "/",
        "/collections/all",
        "/collections/all?sort=price-asc&Color=Oat",
        "/collections/workspace",
        "/products/brass-task-lamp",
        "/cart",
        "/checkout",
        "/advisor",
        "/search?q=linen",
        "/search?q=velvet%20armchair",
        "/advisor?q=travel%20gifts%20under%20%2450",
        "/advisor?q=What%20is%20your%20return%20policy%3F",
        "/does-not-exist",
      ]),
    ).toEqual([]);
  });

  test("merchant console routes have no violations", async ({ page }) => {
    const signedOut = await scan(page, ["/admin/login"]);
    await signInAsMerchant(page, "/admin/orders");
    const productId = "prod_brass-task-lamp";
    const orderId = firstId("SELECT id FROM orders ORDER BY rowid DESC LIMIT 1");
    const eventId = firstId("SELECT id FROM outbox_events ORDER BY rowid DESC LIMIT 1");
    const signedIn = await scan(page, [
      "/admin/orders",
      "/admin/orders?view=review",
      ...(orderId ? [`/admin/orders/${orderId}`] : []),
      "/admin/products",
      `/admin/products/${productId}`,
      `/admin/products/${productId}/content`,
      "/admin/automations",
      ...(eventId ? [`/admin/automations/${eventId}`] : []),
      "/admin/support",
      "/admin/lifecycle",
      "/admin/integrations",
      "/admin/analytics",
      "/admin/upgrade-lab",
      "/admin/upgrade-lab?lab=discovery&q=storage",
      "/admin/upgrade-lab?lab=orders",
    ]);
    expect([...signedOut, ...signedIn]).toEqual([]);
  });
});
