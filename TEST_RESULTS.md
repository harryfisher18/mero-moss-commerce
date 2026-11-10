# Test results

What has actually been run against Mero & Moss, and what those runs do not prove. CI repeats the automated checks on every pull request and on `main`.

## Latest full run

Run on 2026-11-10 on Windows, on the branch for issue #55, based on `8e56719`.

| Command             | What it covers                                         | Result                                   |
| ------------------- | ------------------------------------------------------ | ---------------------------------------- |
| `npm run lint`      | ESLint and Prettier                                    | Pass                                     |
| `npm run typecheck` | Strict TypeScript                                      | Pass                                     |
| `npm test`          | Domain rules and integration tests against real SQLite | Pass, 343 tests in 34 files              |
| `npm run build`     | Production build                                       | Pass                                     |
| `npm run test:e2e`  | Playwright, Chromium on desktop and mobile emulation   | Pass, 124 tests (62 specs on 2 projects) |

The browser tests cover the four mandatory journeys, the demo tour in [DEMO_TOUR.md](DEMO_TOUR.md), and the accessibility scans below.

## Accessibility (axe)

`tests/e2e/accessibility.spec.ts` runs [axe-core](https://github.com/dequelabs/axe-core) through Playwright against WCAG 2.0, 2.1 and 2.2 level A and AA rules, on desktop and mobile Chromium, as part of `npm run test:e2e`.

| Area             | Routes scanned                                                                                                                                                                   | Violations |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Storefront       | Home, collections (with filters), product, cart, checkout, advisor (empty, products, policy), search (results, no matches), 404                                                  | 0          |
| Merchant console | Login, overview, orders, order detail, products, product editor, Content Studio, automations, event detail, requests, lifecycle, integrations, analytics, Upgrade Lab (all tabs) | 0          |

These scans changed the product. Fixed as a result:

- The header cart link's spoken name did not contain its visible text.
- The clay colour was below 4.5:1 even on white. It was darkened, and `tests/unit/contrast.test.ts` now checks the design tokens directly, because axe cannot judge all text on semi-transparent backgrounds.
- Grey text on line-coloured status badges was 4.02:1, found only once the data included a cancelled order.
- Scrollable regions on the analytics and event pages could not be reached by keyboard.

**Limits:** automated rules find only some accessibility problems. No screen-reader or manual keyboard audit has been recorded.

## Performance and quality (Lighthouse)

`npm run build && npm run perf` runs Lighthouse three times per page against the production build. The job also runs in CI and publishes the same report on each run. It is not a required check, because lab timings vary between machines. It fails if accessibility is below 100 or layout shift is above 0.1.

<!-- lighthouse:start -->

| Page                        | Performance | Accessibility | Best practices | SEO | FCP   | LCP   | TBT   | CLS   |
| --------------------------- | ----------- | ------------- | -------------- | --- | ----- | ----- | ----- | ----- |
| `/`                         | 100         | 100           | 100            | 100 | 1.1 s | 1.1 s | 73 ms | 0.000 |
| `/collections/all`          | 100         | 100           | 100            | 100 | 0.9 s | 0.9 s | 39 ms | 0.000 |
| `/products/brass-task-lamp` | 100         | 100           | 100            | 90  | 0.8 s | 0.8 s | 85 ms | 0.000 |

Median of 3 runs per page, by performance score.

Audits not fully passing (best practices and SEO):

- `/`: none
- `/collections/all`: none
- `/products/brass-task-lamp`: meta-description

- **Commit:** `d96ae64`
- **Measured:** 2026-11-08T12:28:24.223Z
- **Tool:** Lighthouse 13.6.0, default mobile configuration
- **Device:** mobile emulation, 412×823 at 1.75x
- **Network and CPU:** simulate throttling: 150 ms RTT, 1638 Kbps down, 4x CPU slowdown
- **Browser:** Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36
- **Host:** win32, 8 CPUs, local machine
- **Target:** production build served from localhost with the seeded demo database and no CDN

<!-- lighthouse:end -->

The commit above is the pull request's branch commit from before its squash merge.

These runs also changed the product. Fixed as a result:

- The collection page shifted by 0.18 as its results streamed in, so the loading state now holds their space.
- The site had no favicon, which logged a 404 on every page.
- A "Learn more" link was replaced with descriptive text.

**Known result:** the product page's SEO score is held back by `meta-description`. Its description depends on live catalog data, so Next.js streams it. A check of the served HTML found it in the `<head>` for Bingbot, and in the streamed page rather than the `<head>` for a regular browser and for Googlebot.

**Limits:** these are lab results from a demo with synthetic data, served from localhost with no CDN and no images beyond inline artwork. They do not predict field performance or any business result.

## Coverage gaps

- **External services:** Shopify and Claude have only been tested against stand-ins. See [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md).
- **Integration states:** the `CONFIGURED`, `CONNECTED_VERIFIED` and `ERROR` displays are covered by unit tests of their logic. The browser tests run with no credentials, so they see `DEMO` only.
- **Browsers:** Chromium only. Safari and Firefox have not been tested.
- **Assistive technology:** no manual screen-reader or keyboard audit.
- **Load:** no load or concurrency testing beyond first-open database safety. The demo runs on SQLite on one server.
- **Deployment:** no production deployment has been made or tested.
