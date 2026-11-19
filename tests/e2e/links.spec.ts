import { expect, type Page, test } from "@playwright/test";
import { signInAsMerchant } from "./helpers";
import { extractLinks, LinkFrontier } from "./link-crawl";

interface BrokenLink {
  readonly path: string;
  readonly status: number;
  readonly linkedFrom: string;
}

/**
 * Visits every internal link reachable from `start`, expanding only pages under `scope`,
 * and returns the links that answered with an error status. Requests share the page's
 * cookies (so the console crawl is signed in) and send Global Privacy Control, so the
 * crawl records no analytics.
 */
async function crawl(page: Page, start: string, scope: (path: string) => boolean) {
  const frontier = new LinkFrontier({ maxTotal: 250, maxPerPathname: 3, maxPerSection: 40 });
  const linkedFrom = new Map<string, string>([[start, "(start)"]]);
  const broken: BrokenLink[] = [];
  const external = new Set<string>();
  let visited = 0;
  frontier.add(start);

  for (let path = frontier.next(); path; path = frontier.next()) {
    visited++;
    const response = await page.request.get(path, { headers: { "Sec-GPC": "1" } });
    if (response.status() >= 400) {
      broken.push({ path, status: response.status(), linkedFrom: linkedFrom.get(path) ?? "" });
      continue;
    }
    const finalUrl = new URL(response.url());
    const isHtml = (response.headers()["content-type"] ?? "").includes("text/html");
    if (!isHtml || !scope(finalUrl.pathname)) continue;

    const links = extractLinks(await response.text(), response.url());
    for (const href of links.external) external.add(href);
    for (const next of links.internal) {
      if (!linkedFrom.has(next)) linkedFrom.set(next, path);
      frontier.add(next);
    }
  }

  test.info().annotations.push({
    type: "links",
    description: `${String(visited)} internal paths checked from ${start}, ${String(frontier.skipped)} skipped by caps. External links (not fetched): ${[...external].sort().join(", ") || "none"}`,
  });
  return { broken, visited };
}

test.describe("internal links", () => {
  // Hundreds of requests in one test: allow more than the 30 s default.
  test.describe.configure({ timeout: 120_000 });

  test("every storefront link reachable from the home page works", async ({ page }) => {
    const { broken, visited } = await crawl(page, "/", (path) => !path.startsWith("/admin"));
    expect(broken).toEqual([]);
    // Guards against a crawl that silently found nothing to check.
    expect(visited).toBeGreaterThan(40);
  });

  test("every console link reachable from the overview works", async ({ page }) => {
    await signInAsMerchant(page, "/admin/overview");
    const { broken, visited } = await crawl(page, "/admin/overview", (path) =>
      path.startsWith("/admin"),
    );
    expect(broken).toEqual([]);
    expect(visited).toBeGreaterThan(15);
  });
});
