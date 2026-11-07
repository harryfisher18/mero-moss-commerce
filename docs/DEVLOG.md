# Development Log

Newest entries first. Every `/pr-test` cycle adds one entry: date, issue, summary, checks with results, PR and merge status, blockers, and the recommended next step.

---

## 2026-11-07: Issue #5, demo checkout (M1)

- **Previous cycle:** #4 merged as `bd29929` (PR #24) through auto-merge. Both checks were green on main.
- **Issue:** [#5](https://github.com/harryfisher18/mero-moss-commerce/issues/5), the demo checkout that creates simulated orders and decrements inventory atomically.
- **Implemented:**
  - Pure `order` domain:
    - zod checkout details: email, name, contiguous-US address (48 states plus DC, matching the shipping policy), and ZIP or ZIP+4.
    - A required simulated-order acknowledgement.
    - `buildOrderDraft` **rejects** (never caps) unavailable, sold-out or over-stock lines.
    - Sequential `MM-1xxxxx` order numbers.
  - Migration 3 adds `orders` and `order_lines`, with price and title snapshots, `CHECK (is_simulated = 1)`, status values and a unique random confirmation token.
  - `OrderService.placeOrder` runs one `BEGIN IMMEDIATE` transaction: re-read cart and live stock, validate, insert order and lines, decrement inventory with a guarded `UPDATE ... WHERE inventory_quantity >= ?`, delete the cart. Any failure rolls back.
  - `/checkout` has a prominent "Simulated order · No payment" disclosure and **no payment fields**. Server-validated field errors use `aria-invalid` and `aria-describedby`, typed values are kept, and checkout is blocked while the cart has issues.
  - `/checkout/confirmation` resolves from an httpOnly, `path=/checkout` cookie token (24 h), so there are no enumerable order URLs and no PII in URLs. The cart cookie is cleared on success.
  - The cart page offers "Continue to checkout" only when every line can be fulfilled.
- **Checks:** `npm run lint` pass · `npm run typecheck` pass · `npm test` pass (10 files, 98 tests, incl. two-shopper oversell, partial-stock rollback, guarded decrement, schema-level simulated-only) · `npm run build` pass · `npm run test:e2e` pass (36 tests: 18 specs × desktop/mobile, 0 server errors) · `next dev` smoke check pass.
- **Journey 1 status:** browse → filter → product → variant → cart → quantity → simulated checkout → confirmation works end to end. The remaining step, "order visible in the merchant console", is #6.
- **Next:** #6, merchant authentication and orders console.

## 2026-11-07: Issue #4, cart (M1)

- **Previous cycles:** #3 merged as `5de39b6` (PR #20). PR #21 (`88db869`) adds the mentor co-author trailer. PR #22 (`27eada1`) was the first auto-merge through the protected `main`.
- **Issue:** [#4](https://github.com/harryfisher18/mero-moss-commerce/issues/4), the cart with persisted state, quantity edits, stock validation and totals.
- **Implemented:**
  - Pure `cart` domain:
    - Add, set and remove built on `validatePurchase`. The combined quantity per variant is bounded by stock and the per-line cap.
    - Up to 20 distinct lines per cart.
    - Pricing in minor units, with per-line issues (unavailable, sold out, quantity reduced) that are excluded from or capped in totals.
    - Shipping estimate (`SHIPPING_RULE`) checked against the stored shipping policy text. Tax is shown explicitly as not charged.
  - Migration 2 adds `carts` and `cart_lines`, behind `SqliteCartRepository`.
  - `CartService` re-reads variants, status and stock and validates inside one `BEGIN IMMEDIATE` transaction. Malformed or unknown cart ids start a new cart, and rejected first adds never create one.
  - Cart identity is an opaque random UUID in an httpOnly, SameSite=Lax cookie (Secure in production) that lasts 30 days. The client never sends prices.
  - zod-validated Server Actions for add, update and remove. The client forms use `useActionState` with polite live-region status messages and call `router.refresh()` on success.
  - Product page: quantity input bounded by stock plus Add to cart. Sold-out options show guidance instead of a dead button.
  - `/cart` with line edits, issue notes, order summary, estimate caveats, a free-shipping progress note and an empty state. The header shows the cart count, streamed at request time.
- **Findings:**
  - `refresh()` from `next/cache` did not re-render the page after a DB-only mutation, so I switched to the documented client `router.refresh()`.
  - `revalidatePath("/", "layout")` exposed a latent prerender error in the `/collections/[handle]` shell. Filed as #23 (P1), and no current code path triggers it.
- **Checks:** `npm run lint` pass · `npm run typecheck` pass · `npm test` pass (8 files, 82 tests) · `npm run build` pass · `npm run test:e2e` pass (28 tests: 14 specs × desktop/mobile, 0 server errors) · `next dev` smoke check pass.
- **PR:** https://github.com/harryfisher18/mero-moss-commerce/pull/24
- **Next:** #5, demo checkout creating simulated orders with atomic inventory decrement.

## 2026-11-07: Repository settings (M0)

- **Co-author:** PR #21 (merged as `88db869`) makes every commit and squash merge carry a `Co-authored-by` trailer for Dominik Lubański (Dominic6018), the project mentor.
- **Visibility:** the owner made the repository **public**. Before relying on that, I scanned all git history for tokens, private keys, `.env` and database files and found none.
- **Protection applied:** `main` requires a PR and both CI checks (strict, up to date), with linear history, conversation resolution, no force pushes or deletions, enforced for admins, and 0 required approvals. Auto-merge, secret scanning and push protection are enabled.
- **Next:** #4, the cart.

## 2026-11-06: Issue #3, product detail page (M1)

- **Previous cycle:** issue #2 merged as `6bcb01b` (PR #19). Both CI jobs were green on main.
- **Issue:** [#3](https://github.com/harryfisher18/mero-moss-commerce/issues/3), the product detail page with variant selection, availability and stored policies.
- **Implemented:**
  - Pure `variant-selection` domain module:
    - Default variant is the first in-stock one, and `?variant=` resolution falls back safely.
    - Per-option value states keep the other selections when that combination exists; otherwise they move to the best variant.
    - Compare-at prices display only when genuinely higher.
    - Availability messages come from real stock.
    - `validatePurchase` is the server-side guard: active product, in-stock variant, integer quantity from 1 to min(stock, 10).
    - Related products rank same category first, then in stock.
  - `/products/[handle]` (Partial Prerender, streamed product view). Accessible option links that work without JS and keep URLs stable; price, compare-at and availability per variant; SKU, materials and care; shipping, returns and warranty from stored policies; related products; breadcrumbs.
  - Unknown or draft products get a real HTTP 404: Proxy runs one indexed `isActiveProductHandle` lookup before rendering, with `notFound()` as a render-time fallback.
  - Product cards link to product pages (stretched link). Filtered collection cards deep-link to the first matching in-stock variant.
- **Scope decision:** the quantity input and Add to cart button move to #4, which wires them to `validatePurchase`. Shipping them now would mean a dead control. Recorded on #3 and #4.
- **Checks:** `npm run lint` pass · `npm run typecheck` pass · `npm test` pass (6 files, 62 tests) · `npm run build` pass · `npm run test:e2e` pass (20 tests: 10 specs × desktop/mobile) · `next dev` smoke check: product 200, unknown product 404.
- **PR:** https://github.com/harryfisher18/mero-moss-commerce/pull/20
- **Next:** #4, the cart with persisted state, Add to cart on the product page, quantity edits and stock validation.

## 2026-11-05: Issue #2, collection pages (M1)

- **Previous cycle:** issue #1 merged as `6b7bb96` (PR #18). CI was green on main.
- **Issue:** [#2](https://github.com/harryfisher18/mero-moss-commerce/issues/2), collection pages with filters, sorting, pagination and stable URL params.
- **Implemented:**
  - Pure `collection-query` domain module. It parses URL params with zod and falls back safely on invalid values. It serializes URLs in a stable, minimal form and handles filtering, sorting, pagination and facets. A product matches only when a single variant satisfies every active filter.
  - `/collections/all` and `/collections/[category]` (Partial Prerender, static params). Filters cover availability, price band and option facets; sorting offers featured, price ascending/descending and newest. Pages also have active-filter chips, Clear all, accessible pagination and an empty state.
  - Filters use a GET form that works without JavaScript. With JavaScript it auto-applies, resets the page, drops empty params and resyncs inputs when the URL changes.
  - Card prices reflect the variants that match the active filters.
  - Header nav, the home CTA and home category sections now link to collections. Category definitions are canonical in the domain, and the seed reuses them.
  - Unknown collection handles get a real HTTP 404 via `src/proxy.ts` (streamed pages would otherwise send 200), plus a branded not-found page.
  - Playwright set up with an isolated E2E DB on a production build, desktop and mobile Chromium projects, and a new CI `e2e` job.
- **Checks:** `npm run lint` pass · `npm run typecheck` pass · `npm test` pass (5 files, 46 tests) · `npm run build` pass · `npm run test:e2e` pass (10 tests: 5 specs × desktop/mobile).
- **Findings fixed during testing:** notFound() in a streamed page returned 200, now fixed with Proxy. Chip removal left checkboxes checked, now fixed by resetting the form on URL change.
- **Not yet:** product cards link to product pages in #3.
- **PR:** https://github.com/harryfisher18/mero-moss-commerce/pull/19
- **Next:** #3, the product detail page with variant selection.

## 2026-11-05 — Issue #1: Catalog foundation (M1)

- **Issue:** [#1](https://github.com/harryfisher18/mero-moss-commerce/issues/1), the catalog domain model, SQLite persistence, seeded catalog and storefront home.
- **Setup completed this cycle:** `gh` is authenticated as harryfisher18 (ADMIN). The repo is private. Merge settings are now squash-only with delete-branch-on-merge. Created 16 labels and roadmap issues #1–#17.
- **Blocked:** branch protection, rulesets and auto-merge return HTTP 403 for private repos on GitHub Free. `/pr-test` merges only after verifying CI green itself.
- **Implemented:**
  - Pure catalog domain (`src/domain/commerce/catalog.ts`, `policies.ts`): availability, price range, option matrix, purchasability.
  - SQLite through `node:sqlite` with versioned migrations and schema-level CHECKs for non-negative price and stock.
  - `CatalogRepository` interface and `SqliteCatalogRepository`, with zod-validated rows.
  - 28 synthetic products / 61 variants across 4 categories, plus 4 stored policies. `npm run db:reset` rebuilds the demo DB.
  - Storefront route group with demo notice, header, footer and skip link. The home page (Partial Prerender) streams featured products, category sections and policies from the DB at request time.
- **Checks:** `npm run lint` pass · `npm run typecheck` pass · `npm test` pass (4 files, 29 tests) · `npm run build` pass (no warnings).
- **Manual verification:** ran `next start`. `/` returns 200 with 34 product cards and 4 categories. Setting a variant's stock to 0 in the DB showed "Sold out" on the next request, which confirms request-time reads. The DB was reset afterwards.
- **Not yet:** product cards are not links until the product page (#3) exists. Collection pages are #2. No E2E yet (#7).
- **PR:** https://github.com/harryfisher18/mero-moss-commerce/pull/18
- **Next:** #2, collection pages with filters, sorting and pagination (or #3 product detail; both depend only on #1).

## 2026-11-05 — Bootstrap (M0)

- **Work:** Initial repository setup. The original product skill moved to `.claude/skills/mero-moss-commerce/` unchanged. Added `CLAUDE.md`, the `/pr-test` skill, a Next.js 16 + strict TypeScript scaffold, ESLint, Vitest, a GitHub Actions CI workflow, issue/PR templates, `TASKS.md` roadmap, `PROJECT_BRIEF.md`, and a typed money module with unit tests.
- **Checks:** `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` were run locally before the bootstrap commit. Results are recorded in the bootstrap report.
- **GitHub:** The existing repo `harryfisher18/mero-moss-commerce` was reused, so no duplicate was created. The bootstrap commit was pushed directly to the empty `main` because no PR is possible against an empty repository. All later work goes through PRs.
- **Next:** Issue #1, the catalog domain model, persistence, and seeded catalog.
