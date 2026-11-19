import { describe, expect, it } from "vitest";
import { extractLinks, LinkFrontier } from "../e2e/link-crawl";

describe("extractLinks", () => {
  it("separates same-origin paths from external links and drops fragments and non-web schemes", () => {
    const html = `
      <a href="/products/felt-desk-mat?variant=v1&amp;x=1#top">Mat</a>
      <a class="x" href="cart">Relative</a>
      <a href="http://localhost:3100/help">Absolute same origin</a>
      <a href="https://github.com/example/repo">External</a>
      <a href="#main">Skip</a>
      <a href="mailto:a@example.com">Mail</a>
      <a href="">Empty</a>
      <link href="/ignored.css" />`;
    expect(extractLinks(html, "http://localhost:3100/collections/all")).toEqual({
      internal: ["/products/felt-desk-mat?variant=v1&x=1", "/collections/cart", "/help"],
      external: ["https://github.com/example/repo"],
    });
  });

  it("lists each link once", () => {
    const html = `<a href="/help">A</a><a href="/help">B</a>`;
    expect(extractLinks(html, "http://localhost:3100/").internal).toEqual(["/help"]);
  });
});

describe("LinkFrontier", () => {
  const drain = (frontier: LinkFrontier) => {
    const out: string[] = [];
    for (let path = frontier.next(); path; path = frontier.next()) out.push(path);
    return out;
  };

  it("queues each path once, breadth-first", () => {
    const frontier = new LinkFrontier({ maxTotal: 10, maxPerPathname: 5, maxPerSection: 5 });
    for (const path of ["/", "/help", "/", "/cart"]) frontier.add(path);
    expect(drain(frontier)).toEqual(["/", "/help", "/cart"]);
    expect(frontier.skipped).toBe(0);
  });

  it("caps query variants, pages per section and the total, and counts what it skipped", () => {
    const frontier = new LinkFrontier({ maxTotal: 5, maxPerPathname: 2, maxPerSection: 2 });
    for (const path of [
      "/collections/all",
      "/collections/all?sort=price-asc",
      "/collections/all?page=2", // third variant: skipped
      "/products/a",
      "/products/b",
      "/products/c", // third product page: skipped
      "/help",
      "/cart", // sixth path: over the total, skipped
    ]) {
      frontier.add(path);
    }
    expect(drain(frontier)).toEqual([
      "/collections/all",
      "/collections/all?sort=price-asc",
      "/products/a",
      "/products/b",
      "/help",
    ]);
    expect(frontier.skipped).toBe(3);
  });
});
