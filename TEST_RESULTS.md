# Test results

What has actually been run against Mero & Moss, and what those runs do not prove. CI repeats the automated checks on every pull request and on `main`.

## Accessibility (axe)

`tests/e2e/accessibility.spec.ts` runs [axe-core](https://github.com/dequelabs/axe-core) through Playwright against WCAG 2.0, 2.1 and 2.2 level A and AA rules, on desktop and mobile Chromium, as part of `npm run test:e2e`.

| Area             | Routes scanned                                                                                                                                                         | Violations |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Storefront       | Home, collections (with filters), product, cart, checkout, advisor (empty, products, policy), 404                                                                      | 0          |
| Merchant console | Login, orders, order detail, products, product editor, Content Studio, automations, event detail, requests, lifecycle, integrations, analytics, Upgrade Lab (all tabs) | 0          |

These scans changed the product. Fixed as a result:

- The header cart link's spoken name did not contain its visible text.
- The clay colour was below 4.5:1 even on white. It was darkened, and `tests/unit/contrast.test.ts` now checks the design tokens directly, because axe cannot judge all text on semi-transparent backgrounds.
- Grey text on line-coloured status badges was 4.02:1, found only once the data included a cancelled order.
- Scrollable regions on the analytics and event pages could not be reached by keyboard.

**Limits:** automated rules find only some accessibility problems. No screen-reader or manual keyboard audit has been recorded.

## Performance and quality (Lighthouse)

`npm run build && npm run perf` runs Lighthouse three times per page against the production build. The job also runs in CI and publishes the same report on each run. It is not a required check, because lab timings vary between machines. It fails if accessibility is below 100 or layout shift is above 0.1.

<!-- lighthouse:start -->
<!-- lighthouse:end -->

The commit above is the pull request's branch commit from before its squash merge.

These runs also changed the product. Fixed as a result:

- The collection page shifted by 0.18 as its results streamed in, so the loading state now holds their space.
- The site had no favicon, which logged a 404 on every page.
- A "Learn more" link was replaced with descriptive text.

**Known result:** the product page's SEO score is held back by `meta-description`. Its description depends on live catalog data, so Next.js streams it. A check of the served HTML found it in the `<head>` for Bingbot, and in the streamed page rather than the `<head>` for a regular browser and for Googlebot.

**Limits:** these are lab results from a demo with synthetic data, served from localhost with no CDN and no images beyond inline artwork. They do not predict field performance or any business result.
