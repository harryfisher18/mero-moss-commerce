/**
 * Runs Lighthouse against the production build, using an isolated demo database.
 *
 *   npm run build && npm run perf            # writes .lighthouse/summary.md
 *   npm run perf -- --record                 # also updates TEST_RESULTS.md
 *
 * The device, network and CPU settings in the report are read from Lighthouse's own
 * result, so the report states what was actually applied.
 */
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import {
  budgetFailures,
  medianRun,
  type PageResult,
  renderSummary,
  replaceRecorded,
  type RunEnvironment,
  type RunMetrics,
} from "./lighthouse-summary";

const PORT = 3200;
const DEBUG_PORT = 9333;
const BASE_URL = `http://localhost:${String(PORT)}`;
const DB_PATH = ".data/lighthouse.db";
const OUTPUT_DIR = ".lighthouse";
const RUNS = 3;
const PAGES = ["/", "/collections/all", "/products/brass-task-lamp"];
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

type Lhr = NonNullable<Awaited<ReturnType<typeof lighthouse>>>["lhr"];

function metrics(lhr: Lhr): RunMetrics {
  const score = (id: string) => Math.round((lhr.categories[id]?.score ?? 0) * 100);
  const numeric = (id: string) => lhr.audits[id]?.numericValue ?? 0;
  return {
    performance: score("performance"),
    accessibility: score("accessibility"),
    bestPractices: score("best-practices"),
    seo: score("seo"),
    fcpMs: numeric("first-contentful-paint"),
    lcpMs: numeric("largest-contentful-paint"),
    tbtMs: numeric("total-blocking-time"),
    cls: numeric("cumulative-layout-shift"),
    speedIndexMs: numeric("speed-index"),
    notPassing: ["best-practices", "seo"].flatMap((id) =>
      (lhr.categories[id]?.auditRefs ?? [])
        .filter((ref) => ref.weight > 0 && (lhr.audits[ref.id]?.score ?? 1) < 1)
        .map((ref) => ref.id),
    ),
  };
}

function environment(lhr: Lhr): RunEnvironment {
  const { formFactor, screenEmulation: screen, throttlingMethod, throttling } = lhr.configSettings;
  return {
    commit: execFileSync("git", ["rev-parse", "--short", "HEAD"]).toString().trim(),
    fetchedAt: lhr.fetchTime,
    lighthouseVersion: lhr.lighthouseVersion,
    host: `${process.platform}, ${String(cpus().length)} CPUs${process.env.CI ? ", CI runner" : ", local machine"}`,
    browser: lhr.environment.hostUserAgent,
    device: `${formFactor} emulation, ${String(screen.width)}×${String(screen.height)} at ${String(screen.deviceScaleFactor)}x`,
    network: `${throttlingMethod} throttling: ${String(throttling.rttMs)} ms RTT, ${String(Math.round(throttling.throughputKbps ?? 0))} Kbps down, ${String(throttling.cpuSlowdownMultiplier)}x CPU slowdown`,
  };
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(BASE_URL)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The production server did not start. Run `npm run build` first.");
}

async function main(): Promise<number> {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
    {
      env: { ...process.env, MERO_MOSS_DB_PATH: DB_PATH, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: "ignore",
    },
  );
  const browser = await chromium.launch({
    channel: "chromium",
    args: [`--remote-debugging-port=${String(DEBUG_PORT)}`],
  });
  try {
    await waitForServer();
    const results: PageResult[] = [];
    let env: RunEnvironment | null = null;
    for (const path of PAGES) {
      const runs: RunMetrics[] = [];
      for (let run = 0; run < RUNS; run += 1) {
        const result = await lighthouse(`${BASE_URL}${path}`, {
          port: DEBUG_PORT,
          output: "json",
          logLevel: "error",
          onlyCategories: CATEGORIES,
        });
        if (!result) throw new Error(`Lighthouse returned nothing for ${path}`);
        runs.push(metrics(result.lhr));
        env ??= environment(result.lhr);
      }
      results.push({ path, runs: RUNS, ...medianRun(runs) });
      console.log(`Measured ${path}`);
    }
    if (!env) throw new Error("No Lighthouse results");

    const summary = renderSummary(results, env);
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(`${OUTPUT_DIR}/summary.md`, `${summary}\n`);
    writeFileSync(`${OUTPUT_DIR}/results.json`, JSON.stringify({ env, results }, null, 2));
    console.log(`\n${summary}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Lighthouse\n\n${summary}\n`);
    }
    if (process.argv.includes("--record")) {
      writeFileSync(
        "TEST_RESULTS.md",
        replaceRecorded(readFileSync("TEST_RESULTS.md", "utf8"), summary),
      );
    }

    const failures = budgetFailures(results);
    for (const failure of failures) console.error(`Budget failed: ${failure}`);
    return failures.length === 0 ? 0 : 1;
  } finally {
    await browser.close();
    server.kill();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
