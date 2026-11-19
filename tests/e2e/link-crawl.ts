/**
 * Pure helpers for the internal link check: pulling links out of server-rendered HTML and
 * deciding which ones to visit. No browser or network code, so they are unit-tested in
 * tests/unit/link-crawl.test.ts.
 */

export interface PageLinks {
  /** Same-origin paths with their query string, without any #fragment. */
  readonly internal: string[];
  /** Absolute http(s) links to other sites. Reported, never fetched. */
  readonly external: string[];
}

const ANCHOR_HREF = /<a\b[^>]*?\shref="([^"]*)"/gi;

const decodeEntities = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** Every link in the page's HTML, including content streamed into the same response. */
export function extractLinks(html: string, pageUrl: string): PageLinks {
  const base = new URL(pageUrl);
  const internal = new Set<string>();
  const external = new Set<string>();
  for (const match of html.matchAll(ANCHOR_HREF)) {
    const raw = decodeEntities(match[1] ?? "").trim();
    if (raw === "" || raw.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(raw)) continue;
    let url: URL;
    try {
      url = new URL(raw, base);
    } catch {
      continue;
    }
    if (url.origin === base.origin) internal.add(`${url.pathname}${url.search}`);
    else if (url.protocol === "http:" || url.protocol === "https:") external.add(url.href);
  }
  return { internal: [...internal], external: [...external] };
}

export interface FrontierLimits {
  /** Paths visited in total. */
  readonly maxTotal: number;
  /** Query-string variants of one pathname, such as filter and sort combinations. */
  readonly maxPerPathname: number;
  /** Pages under one parent path, such as every /products/… or every /admin/orders/… page. */
  readonly maxPerSection: number;
}

const sectionOf = (pathname: string) => pathname.slice(0, pathname.lastIndexOf("/")) || "/";

/**
 * A breadth-first queue of paths to check. Each path is queued once. Caps keep generated
 * variants (filters, pagination, one page per order) from growing the crawl without bound.
 * Paths over a cap are counted, so the test can report how much was skipped.
 */
export class LinkFrontier {
  private readonly queue: string[] = [];
  private readonly seen = new Set<string>();
  private readonly perPathname = new Map<string, number>();
  private readonly perSection = new Map<string, number>();
  private skippedCount = 0;

  constructor(private readonly limits: FrontierLimits) {}

  add(path: string): void {
    if (this.seen.has(path)) return;
    this.seen.add(path);
    const pathname = path.split("?")[0] ?? path;
    const section = sectionOf(pathname);
    const variants = this.perPathname.get(pathname) ?? 0;
    const inSection = this.perSection.get(section) ?? 0;
    const isNewPathname = variants === 0;
    if (
      this.seen.size - this.skippedCount > this.limits.maxTotal ||
      variants >= this.limits.maxPerPathname ||
      (isNewPathname && inSection >= this.limits.maxPerSection)
    ) {
      this.skippedCount++;
      return;
    }
    this.perPathname.set(pathname, variants + 1);
    if (isNewPathname) this.perSection.set(section, inSection + 1);
    this.queue.push(path);
  }

  next(): string | undefined {
    return this.queue.shift();
  }

  get skipped(): number {
    return this.skippedCount;
  }
}
