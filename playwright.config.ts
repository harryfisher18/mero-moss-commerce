import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const E2E_DB_PATH = ".data/e2e.db";

/**
 * E2E tests run against a production build (`npm run build` first) served with an
 * isolated database that is recreated from seed data on every run.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run db:reset && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { MERO_MOSS_DB_PATH: E2E_DB_PATH, NEXT_TELEMETRY_DISABLED: "1" },
  },
});
