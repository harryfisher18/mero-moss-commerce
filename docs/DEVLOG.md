# Development Log

Newest entries first. Every `/pr-test` cycle adds one entry: date, issue, summary, checks with results, PR and merge status, blockers, and the recommended next step.

---

## 2026-11-08: Issue #9, durable order automation (M2, Journey 3)

- **Previous cycle:** #8 merged as `88e334c` (PR #27) through auto-merge.
- **Issue:** [#9](https://github.com/harryfisher18/mero-moss-commerce/issues/9), the durable order event outbox and worker with retries, idempotency and a job inspector.
- **Implemented:**
  - Domain (`src/domain/events`, pure):
    - `retry-policy`: 5 attempts with bounded exponential backoff (10 s, 20 s, 40 s, 1 min 20 s, capped at 10 min), no jitter so it is testable. Permanent failures dead-letter immediately.
    - `order-created`: the event payload (no street address), ship-zone routing for every region, review rules (total of $500 or more, 5 or more units in one line), notification previews, and PII redaction for the inspector.
    - `outbox`: event types, statuses and two labelled failure drills.
  - Migration 6 adds `outbox_events`, `job_attempts`, `order_tags` and `notification_previews`. Effects have unique keys per event, and previews are constrained to `preview_only` delivery.
  - `OrderService.placeOrder` writes the `order.created` event inside the order transaction (transactional outbox).
  - `AutomationService` makes each attempt in one `BEGIN IMMEDIATE` transaction: it re-checks eligibility, runs the handler in a savepoint, then records success, the next retry or the dead letter. A failed attempt leaves no partial effects. Replays and second workers create no duplicate effects.
  - The worker runs in three places: `after()` once the checkout response is sent, "Run due jobs" in the console, and `npm run worker` for scheduled retries.
  - `/admin/automations` shows the job log with status filters and counts, the retry policy, "Run due jobs" and the failure drills. `/admin/automations/[id]` shows tags, notification previews marked "Preview only · not sent", the redacted payload, details, the attempt log, Replay and Retry now. Order detail gains an Automation panel, and the console nav gains Automations.
- **Checks:** `npm run lint` pass · `npm run typecheck` pass · `npm test` pass (17 files, 159 tests) · `npm run build` pass · `npm run test:e2e` pass (54 tests: 27 specs × desktop/mobile) · `npm run worker -- --once` processed a due drill and scheduled its retry · `next dev` smoke check pass (automation routes 307 to login when signed out).
- **Journey 3 status:** done for the demo store, and E2E-proven: event → worker → tags and previews, idempotent replay, retries, and the dead letter with operator action. Verified Shopify webhook delivery (step 1, "if configured") belongs to #14. No live side effects exist to authorize.
- **Next:** #11, the AI Shopping Advisor grounded in catalog data (Journey 4; it also completes the AI part of Journey 2).

## 2026-11-07: Issue #8, merchant product editor (M2, Journey 2)

- **Previous cycle:** #6 and #7 merged as `2eddbeb` (PR #26) through auto-merge. M1 is complete.
- **Issue:** [#8](https://github.com/harryfisher18/mero-moss-commerce/issues/8), the merchant product editor that propagates to the storefront with an audit log.
- **Implemented:**
  - Domain:
    - `parseMoneyInput` reads merchant input like "48", "48.5" or "$1,048.50" exactly into minor units with no floats, capped at $99,999.99. `toDecimalString` goes the other way.
    - `parseProductEdit` validates text fields, status and every variant's price, compare-at (must be above the price) and stock (0–100,000), and requires exactly the product's variants. Errors are reported per field.
    - `diffProductEdit` produces one audit change per modified field.
  - Migration 5 adds `catalog_audit_events`.
  - `ProductEditService.save` runs in one transaction with optimistic concurrency on `updated_at`, so stale forms are rejected rather than overwriting newer edits. It writes the product and variants and records an audit row per changed field. Unchanged forms are a no-op.
  - `/admin/products` lists every product with status, category, variants, stock and price range. `/admin/products/[id]` is the editor: per-field errors with `aria-invalid` and `aria-describedby`, submitted values echoed back on error, remount after save, and a change history showing before → after, actor and time. A "View in store" link shows for active products. The console nav gains a Products link.
  - The `saveProduct` Server Action re-verifies the session, validates shape and bounds, and records the merchant's email as the actor.
- **Propagation:** storefront, cart and checkout read the catalog at request time, so edits appear on the next request with no cache invalidation. That also means #23 is not triggered.
- **Checks:** `npm run lint` pass · `npm run typecheck` pass · `npm test` pass (14 files, 128 tests) · `npm run build` pass · `npm run test:e2e` pass (48 tests: 24 specs × desktop/mobile, 0 server errors) · `next dev` smoke check pass (editor routes 307 to login when signed out).
- **Journey 2 status:** the storefront and cart parts are done and E2E-proven. The "AI assistant reflects new values" part depends on the advisor (#11), which will read the same request-time catalog.
- **PR:** https://github.com/harryfisher18/mero-moss-commerce/pull/27
- **Next:** #9, the durable order event outbox and worker (Journey 3).

## 2026-11-07: Issues #6 + #7, merchant console and Journey 1 E2E (M1)

- **Previous cycle:** #5 merged as `5f0d59c` (PR #25) through auto-merge. Both checks were green on main.
- **Issues:** [#6](https://github.com/harryfisher18/mero-moss-commerce/issues/6), merchant authentication and orders console. [#7](https://github.com/harryfisher18/mero-moss-commerce/issues/7), the Journey 1 E2E in CI. I did them together because #7's last step needs #6.
- **Implemented:**
  - Domain:
    - Order status lifecycle (placed → processing → fulfilled; placed/processing → cancelled; terminal states; cancellation restocks).
    - scrypt password hashing with bounded parameters and timing-safe compare, constant-time email match, and a login rate-limit rule (5 failures per 15 minutes).
    - `safeAdminPath` open-redirect guard.
  - Migration 4 adds `merchant_sessions` (SHA-256 of the token only, expiry), `login_attempts` and `order_status_events` (audit of from, to, actor and time). Order placement records the first "placed" event.
  - `MerchantAuthService`: login with rate limiting, always running the hash check; random 256-bit tokens; 8 h sessions; verify and logout. `MerchantOrderService` lists and reads orders and applies transitions in a transaction, with audit and restock.
  - Demo credentials come from env, with a documented public default shown on the login page only while active. `npm run merchant:hash` generates a hash.
  - Cookie `mm_admin`: httpOnly, SameSite=Strict, Secure in production.
  - Proxy redirects signed-out `/admin/*` requests (307 with `next`) before rendering. Every page and Server Action re-verifies with `requireMerchant()`.
  - `/admin/orders` has status filters and a table of number, date, customer, items, total and status. `/admin/orders/[id]` shows lines, totals, customer, validated status actions and history. The console layout has a "Demo data" badge and sign out.
  - E2E: a full Journey 1 spec (home → collection → filter → product → variant → cart → quantity → checkout → merchant sees the order with a matching total) and an admin spec (307 redirect, wrong password, sign in and out, lifecycle with history, cancel restocks, status filter).
- **Findings fixed during testing:**
  - The session check read the clock during prerendering, which errored on `/admin/orders`. Fixed with `await connection()` before the session read.
  - An E2E helper race: login didn't wait for the redirect.
- **Checks:** `npm run lint` pass · `npm run typecheck` pass · `npm test` pass (12 files, 114 tests) · `npm run build` pass · `npm run test:e2e` pass (44 tests: 22 specs × desktop/mobile, 0 server errors) · `next dev` smoke check pass (`/admin/orders` 307 to login, login 200).
- **Milestone:** M1, the complete commerce loop, is done. Journey 1 passes end to end in CI.
- **PR:** https://github.com/harryfisher18/mero-moss-commerce/pull/26
- **Next:** #8, the merchant product editor that propagates to the storefront with an audit log (Journey 2).

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
- **PR:** https://github.com/harryfisher18/mero-moss-commerce/pull/25
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
