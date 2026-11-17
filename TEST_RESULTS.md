# Test results

What has actually been run against Mero & Moss, and what those runs do not prove. CI repeats the automated checks on every pull request and on `main`.

## Latest full run

Run on 2026-11-17 on Windows, on the branch for issue #65, based on `f107310`.

| Command             | What it covers                                         | Result                                   |
| ------------------- | ------------------------------------------------------ | ---------------------------------------- |
| `npm run lint`      | ESLint and Prettier                                    | Pass                                     |
| `npm run typecheck` | Strict TypeScript                                      | Pass                                     |
| `npm test`          | Domain rules and integration tests against real SQLite | Pass, 367 tests in 38 files              |
| `npm run build`     | Production build                                       | Pass                                     |
| `npm run test:e2e`  | Playwright, Chromium on desktop and mobile emulation   | Pass, 138 tests (69 specs on 2 projects) |

The browser tests cover the four mandatory journeys, the demo tour in [DEMO_TOUR.md](DEMO_TOUR.md), and the accessibility scans below.

## Accessibility (axe)

`tests/e2e/accessibility.spec.ts` runs [axe-core](https://github.com/dequelabs/axe-core) through Playwright against WCAG 2.0, 2.1 and 2.2 level A and AA rules, on desktop and mobile Chromium, as part of `npm run test:e2e`.

| Area             | Routes scanned                                                                                                                                                                             | Violations |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Storefront       | Home (also with a merchant announcement), collections (with filters), product, cart, checkout, advisor (empty, products, policy), search (results, no matches), help, 404                  | 0          |
| Merchant console | Login, overview, orders, order detail, products, product editor, Content Studio, automations, event detail, requests, lifecycle, integrations, analytics, Upgrade Lab (all tabs), settings | 0          |

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

## Acceptance gates

Each hard acceptance gate from the product requirements, with the evidence that it holds. Audited on 2026-11-17 (#65) against `f107310`. Test names are from `tests/e2e/` unless they end in `.test.ts`. "Partly" means the gate holds, but part of the evidence is by design or by inspection rather than a test. Each gap has its own issue.

| #   | Gate                                                                                                                                                  | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Browse, filter, select a variant, add to cart and place a labelled simulated order without external keys                                              | Met    | `journey-shopper-to-order`: "Journey 1: shopper to order, visible to the merchant". `collections`: "filter by option, sort by price, then remove the filter". `checkout`: "shopper places a simulated order that decrements stock", which also checks that there are no payment fields. E2E runs with no keys.                                                                                                                                                                   |
| 2   | The order appears in the authenticated merchant view, and totals, inventory and variants are consistent                                               | Met    | "Journey 1" opens the order in `/admin/orders`. `checkout`: stock decrements, and a sell-out during checkout is rejected without an order. `cart`: "the server enforces stock even when the browser is bypassed". `overview`: every figure matches the database.                                                                                                                                                                                                                 |
| 3   | The storefront is usable on mobile and desktop, with no dead links or buttons, and credible loading, empty and error states                           | Partly | Every E2E runs on desktop and Pixel 7 emulation, and nine specs check for horizontal overflow. The axe scans in `accessibility` find 0 violations. Empty states: `collections` "shows an empty state with a way back", `search` "no matches…" and "an empty search…". Real 404s for unknown products and collections. **Gap:** links are only checked where a test follows them. Nothing crawls every internal link (#66).                                                       |
| 4   | A merchant's price or stock change updates the product page, cart checks and AI suggestions                                                           | Met    | `journey-merchant-edit`: "Journey 2: merchant edits propagate to the storefront and cart" covers the product page, the cart line, the advisor card and unpublishing. Edits are previewed before publishing (#59).                                                                                                                                                                                                                                                                |
| 5   | A persisted order event goes through the worker to review and a notification preview, replay doesn't double-run effects, and failures are inspectable | Met    | `journey-order-automation`: "Journey 3: an order event is routed, previewed and replays idempotently" and "failed jobs retry with backoff, then dead-letter for operator action". `order-review`: "a flagged order is held until a person clears it".                                                                                                                                                                                                                            |
| 6   | The AI shopping answer matches the catalog and policies, works without an LLM key, doesn't leak customer data, and offers escalation                  | Partly | `advisor`: "recommends in-stock variants within budget at their exact current prices", "is honest about sold-out items, policies and discounts", and "a shopper can reach a person, and the merchant sees the request". `advisor.test.ts` rejects contact details in model wording. No leak is possible by design, because the recommendation provider only receives products and policies. **Gap:** no test asserts that stored customer data never appears in an answer (#67). |
| 7   | AI content edits need merchant review before they apply, and all demo changes are logged                                                              | Partly | `journey-content-studio`: "Journey 4b: content draft → factual checks → approval → storefront with audit". Change history exists for product edits, order status, review clearance and branding. **Gap:** a demo reset is not itself recorded anywhere (#68).                                                                                                                                                                                                                    |
| 8   | The Upgrade Lab is interactive and explicitly illustrative, with no fake measured uplift                                                              | Met    | `upgrade-lab`: the product page, discovery and orders tests. The only measurements are control sizes read from the rendered panels.                                                                                                                                                                                                                                                                                                                                              |
| 9   | No live payments, sends, product publishing, fulfillment or refunds without explicit permission                                                       | Met    | There are no payment fields (`checkout`). Lifecycle messages are stored with `delivery = 'preview_only'`, enforced by a database CHECK constraint, and `lifecycle` covers consent. Notification previews are marked "Preview only · not sent". The Shopify adapter has no write path. The fulfillment preview sends nothing.                                                                                                                                                     |
| 10  | Verified integrations are distinguished from simulated ones, and unverified connectors are never shown as working                                     | Met    | `integrations`: "with no credentials, everything is honestly in demo mode". Unit tests cover the `CONFIGURED`, `CONNECTED_VERIFIED` and `ERROR` logic. Shopify has not been verified (#49, blocked).                                                                                                                                                                                                                                                                             |
| 11  | Tests, lint, production build and E2E were actually run, with results and limitations documented                                                      | Met    | CI runs all of them on every PR and on `main`. This file records the latest local run, the axe and Lighthouse results, and the coverage gaps.                                                                                                                                                                                                                                                                                                                                    |
| 12  | The product maps onto several specific client project types                                                                                           | Met    | [FEATURE_TO_CLIENT_REQUEST.md](FEATURE_TO_CLIENT_REQUEST.md) and [SERVICE_ADAPTATIONS.md](SERVICE_ADAPTATIONS.md), refreshed in this audit.                                                                                                                                                                                                                                                                                                                                      |

## Coverage gaps

- **External services:** Shopify and Claude have only been tested against stand-ins. See [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md).
- **Integration states:** the `CONFIGURED`, `CONNECTED_VERIFIED` and `ERROR` displays are covered by unit tests of their logic. The browser tests run with no credentials, so they see `DEMO` only.
- **Browsers:** Chromium only. Safari and Firefox have not been tested.
- **Assistive technology:** no manual screen-reader or keyboard audit.
- **Load:** no load or concurrency testing beyond first-open database safety. The demo runs on SQLite on one server.
- **Deployment:** no production deployment has been made or tested.
