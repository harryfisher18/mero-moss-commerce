/** Pure helpers for the Lighthouse run: choosing a run, budgets and the Markdown report. */

export interface RunMetrics {
  readonly performance: number;
  readonly accessibility: number;
  readonly bestPractices: number;
  readonly seo: number;
  readonly fcpMs: number;
  readonly lcpMs: number;
  readonly tbtMs: number;
  readonly cls: number;
  readonly speedIndexMs: number;
  /** Scored audits in these categories that did not fully pass. */
  readonly notPassing: readonly string[];
}

export interface PageResult extends RunMetrics {
  readonly path: string;
  readonly runs: number;
}

export interface RunEnvironment {
  readonly commit: string;
  readonly fetchedAt: string;
  readonly lighthouseVersion: string;
  readonly host: string;
  readonly browser: string;
  readonly device: string;
  readonly network: string;
}

/** The run with the median performance score, as Lighthouse's own guidance suggests. */
export function medianRun<T extends { readonly performance: number }>(runs: readonly T[]): T {
  const sorted = [...runs].sort((a, b) => a.performance - b.performance);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (!median) throw new Error("No Lighthouse runs to summarize");
  return median;
}

/** Limits for the stable, machine-independent results only. Lab timings vary by runner. */
export const BUDGET = { minAccessibility: 100, maxCls: 0.1 } as const;

export function budgetFailures(pages: readonly PageResult[]): string[] {
  return pages.flatMap((page) => [
    ...(page.accessibility < BUDGET.minAccessibility
      ? [
          `${page.path}: accessibility ${String(page.accessibility)} is below ${String(BUDGET.minAccessibility)}`,
        ]
      : []),
    ...(page.cls > BUDGET.maxCls
      ? [`${page.path}: layout shift ${String(page.cls)} is above ${String(BUDGET.maxCls)}`]
      : []),
  ]);
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export function renderSummary(pages: readonly PageResult[], env: RunEnvironment): string {
  const rows = pages.map((page) =>
    [
      `\`${page.path}\``,
      page.performance,
      page.accessibility,
      page.bestPractices,
      page.seo,
      seconds(page.fcpMs),
      seconds(page.lcpMs),
      `${String(Math.round(page.tbtMs))} ms`,
      page.cls.toFixed(3),
    ].join(" | "),
  );
  return [
    "| Page | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
    "",
    `Median of ${String(pages[0]?.runs ?? 0)} runs per page, by performance score.`,
    "",
    "Audits not fully passing (best practices and SEO):",
    "",
    ...pages.map(
      (page) =>
        `- \`${page.path}\`: ${page.notPassing.length > 0 ? page.notPassing.join(", ") : "none"}`,
    ),
    "",
    `- **Commit:** \`${env.commit}\``,
    `- **Measured:** ${env.fetchedAt}`,
    `- **Tool:** Lighthouse ${env.lighthouseVersion}, default mobile configuration`,
    `- **Device:** ${env.device}`,
    `- **Network and CPU:** ${env.network}`,
    `- **Browser:** ${env.browser}`,
    `- **Host:** ${env.host}`,
    "- **Target:** production build served from localhost with the seeded demo database and no CDN",
  ].join("\n");
}

export const RECORD_START = "<!-- lighthouse:start -->";
export const RECORD_END = "<!-- lighthouse:end -->";

/** Replaces the recorded block in TEST_RESULTS.md. */
export function replaceRecorded(document: string, summary: string): string {
  const start = document.indexOf(RECORD_START);
  const end = document.indexOf(RECORD_END);
  if (start < 0 || end < start) throw new Error("Lighthouse markers not found in TEST_RESULTS.md");
  return `${document.slice(0, start)}${RECORD_START}\n\n${summary}\n\n${document.slice(end)}`;
}
