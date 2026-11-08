# Development Log

Newest entries first. Every `/pr-test` cycle adds one entry: date, issue, summary, checks with results, PR and merge status, blockers, and the recommended next step.

---

## 2026-11-08: Issue #14, integrations status and the Shopify adapter seam

- **Previous cycle:** #13 merged as `988d840` (PR #40) through auto-merge.
- **Issue:** [#14](https://github.com/harryfisher18/mero-moss-commerce/issues/14), an honest integrations page and a `StorePlatformAdapter` seam.
- **Implemented:**
  - `src/domain/integrations/shopify.ts`: configuration parsing that names problems but never repeats values and only accepts `*.myshopify.com` domains, plus `verifyShopifyWebhook` (base64 HMAC-SHA256 over the raw body with a timing-safe compare).
  - `StorePlatformAdapter`, read-only by design: `DemoStoreAdapter` over the local catalog and `ShopifyStoreAdapter` (Admin GraphQL, cursor pagination, 10 s timeout, zod-validated responses).
  - `PlatformStatus`: configuration alone never reports a working connection; only a successful real check gives `CONNECTED_VERIFIED`.
  - `/admin/integrations`: states for the catalog, Shopify, both Claude features and notifications, whether each setting is set (never its value), and what is not built. There is no Connect button, and Verify renders only with a complete configuration.
- **Not verified:** no Shopify store or credentials exist, so the Shopify adapter is tested against a fake transport only and no webhook endpoint exists yet.
- **Checks:** `npm run lint` pass · `npm run typecheck` pass · `npm test` pass (26 files, 267 tests) · `npm run build` pass · `npm run test:e2e` pass (88 tests: 44 specs × desktop/mobile) · `next dev` smoke check pass (integrations 307 to login when signed out).
- **Next:** #15, consent-gated lifecycle journey previews (P1).

## 2026-11-08: Issue #13, first-party analytics and funnel view

- **Previous cycle:** #10 merged as `49ce755` (PR #39) through auto-merge.
- **Issue:** [#13](https://github.com/harryfisher18/mero-moss-commerce/issues/13), first-party analytics events and a funnel view.
- **Implemented:**
  - Domain (`src/domain/analytics/funnel.ts`, pure): a session counts at a step only if it reached every earlier step in order; conversion and drop-off; the beacon schema; the Global Privacy Control check.
  - Migration 9 adds `analytics_events`: an anonymous session id, event name, product, quantity and value. There is no column for personal data, and no cart or order id.
  - Recording: `add_to_cart` and `purchase` from the Server Actions. `view_item` and `begin_checkout` from `POST /api/analytics`, which requires a same-origin request and checks the real product or cart. Failures never break shopping.
  - The session cookie is set by Proxy before the product page renders, so a quick add-to-cart cannot start a second session. It holds only a random id and lasts until the browser closes.
  - `/admin/analytics` shows the funnel from recorded rows, labelled demo-session data, with its limitations. The storefront footer discloses what is recorded.
- **Bug found and fixed:** the new background writes exposed a race in the E2E helper, whose direct database connection had no busy timeout and could fail with "database is locked". It now waits as the server does.
- **Checks:** `npm run lint` pass · `npm run typecheck` pass · `npm test` pass (24 files, 235 tests) · `npm run build` pass · `npm run test:e2e` pass (84 tests: 42 specs × desktop/mobile) · `next dev` smoke check pass (analytics 307 to login when signed out; the session cookie is set on a product page and not when `Sec-GPC: 1` is sent).
- **PR:** [#40](https://github.com/harryfisher18/mero-moss-commerce/pull/40)
- **Next:** #14, integrations status page and StorePlatformAdapter Shopify seam (P1).

## 2026-11-08: Issue #10, Upgrade Lab (M2)

- **Previous cycle:** #36 merged as `83a1efb` (PR #37) through auto-merge.
- **Issue:** [#10](https://github.com/harryfisher18/mero-moss-commerce/issues/10), illustrative before/after for the product page, discovery and order operations.
- **Implemented:**
  - Domain (`src/domain/upgrade-lab`, pure): the three "before" behaviours (a fixed "From" price with a late, vague sold-out error; whole-phrase title search; an unstructured order note with personal data masked), a sample order for stores with no orders, a manual-triage check, and URL validation with zod.
  - `/admin/upgrade-lab`, with a nav link and three tabs:
    - Mobile product page: the same catalog product in two phone frames, with the "after" using the store's real variant, price and stock rules. Neither side changes a real cart.
    - Product discovery: one question through title search and the deterministic advisor, so no model is called.
    - Order operations: a recent real order as a note with a manual decision, against the real routing, review tags and notification previews, linking to the order's job log.
  - Every comparison is labelled illustrative. "Measure these panels" reads control counts and sizes from the rendered DOM and says so; there are no uplift, conversion or speed figures.
- **Found, not fixed here:** signing in loses the query string of the requested admin page. Filed as #38.
- **Checks:** `npm run lint` pass · `npm run typecheck` pass · `npm test` pass (22 files, 221 tests) · `npm run build` pass · `npm run test:e2e` pass (74 tests: 37 specs × desktop/mobile) · `next dev` smoke check pass with no API key (lab 307 to login when signed out; the storefront does not mention it).
- **PR:** [#39](https://github.com/harryfisher18/mero-moss-commerce/pull/39)
- **Next:** #13, first-party analytics events and funnel view (P1).

## 2026-11-08: Issue #36, bring this log up to date after the history rewrites (docs)

- **Previous change:** #34 merged as `f53d8ad` (PR #35).
- **Change:** commit IDs cited in this log now match the rewritten `main`. References to the removed co-author arrangement are gone, and the #32 and #34 entries describe what actually happened.
- **PR:** [#37](https://github.com/harryfisher18/mero-moss-commerce/pull/37)
- **Checks:** `npm run lint` pass (docs only, no code changes).
- **Next:** #10, Upgrade Lab (P1).

## 2026-11-08: Issue #34, co-author commits with the owner and Claude (chore)

- **Previous change:** #32 merged as `fd8bb5b`.
- **Change:** at the owner's request, every commit and squash merge carries `Co-authored-by` trailers for Harry Fisher and Claude. `CLAUDE.md` and the `/pr-test` workflow are updated.
- **History:** the owner authorized one-off rewrites of `main` that removed earlier co-author trailers and added both trailers to all existing commits. Branch protection was lifted only for those pushes and restored to its previous settings.
- **Checks:** `npm run lint` pass (docs only, no code changes).
- **PR:** [#35](https://github.com/harryfisher18/mero-moss-commerce/pull/35)
- **Next:** #10, Upgrade Lab (P1).

## 2026-11-08: Issue #32, stop requiring the previous co-author trailer (chore)

- **Previous cycle:** #23 merged as `c132d11` (PR #31) through auto-merge.
- **Change:** at the owner's request, `CLAUDE.md` and the `/pr-test` workflow stopped requiring the previous co-author trailer. #34 replaced this rule.
- **Checks:** `npm run lint` pass (docs only, no code changes).
- **Next:** #10, Upgrade Lab (P1).

## 2026-11-08: Issue #23, collection shell survives path revalidation (bug, P1)

- **Previous cycle:** #12 merged as `1b689ac` (PR #30) through auto-merge. All four mandatory journeys are done.
- **Issue:** [#23](https://github.com/harryfisher18/mero-moss-commerce/issues/23), the collection page shell fails to re-prerender when paths are revalidated.
- **Reproduced first:** a production build with a temporary `revalidatePath("/", "layout")` in `addToCart` (never committed). After one add-to-cart, `/collections/workspace` and `/collections/all` returned **HTTP 500** with "Route \"/collections/[handle]\": Next.js encountered uncached or runtime data during prerendering". That is worse than the logged error the issue describes.
- **Fix:**
  - `CollectionPage` is no longer async. It passes the `params` promise to `CollectionContent` inside `<Suspense>`, with a skeleton fallback, following the Next 16 caching guide.
  - Known handles are still fully prerendered via `generateStaticParams`: the built `workspace.html` and `all.html` shells contain the real `<h1>`.
  - `/products/[handle]` already read params inside Suspense and needed no change.
- **Verified with the same reproduction after the fix:** 200 with the correct `<h1>` for both collections, 404 for an unknown handle, 200 for product pages, and no errors in the server log. The temporary code was then reverted.
- **Checks:** `npm run lint` pass · `npm run typecheck` pass · `npm test` pass (21 files, 211 tests) · `npm run build` pass (collection routes still Partial Prerender) · `npm run test:e2e` pass (66 tests).
- **Regression coverage:** no product code calls `revalidatePath` (all catalog reads are request-time), so a permanent automated test would need speculative revalidation. The manual reproduction above is documented in the PR instead.
- **PR:** [#31](https://github.com/harryfisher18/mero-moss-commerce/pull/31)
- **Next:** #10, Upgrade Lab (P1).

## 2026-11-08: Issue #12, AI Content Studio (M3, Journey 4b)

- **Previous cycle:** #11 merged as `8911aef` (PR #29) through auto-merge, after CI caught a mobile nav overflow that was fixed in the same PR.
- **Issue:** [#12](https://github.com/harryfisher18/mero-moss-commerce/issues/12), product content drafts with a diff, approval and an audited demo publish.
- **Implemented:**
  - Domain (`src/domain/content`, pure):
    - Product facts sheet.
    - Deterministic rules draft: keeps the title and summary, and builds an SEO description of at most 160 characters from the summary, materials, real option values and category.
    - Word-level diff.
    - `checkContent`: length limits; no prices; no numbers, percentages or materials outside the facts; no promotional or unverifiable claims unless the facts state them (for example "FSC-certified").
  - Migration 8 adds `products.seo_description` and versioned `content_drafts` (pending, approved, rejected, superseded).
  - `ContentDraftProvider`:
    - Rules provider, always available and labelled.
    - Optional `AnthropicContentDraftProvider` (official SDK, structured JSON output, `claude-opus-5-5`, low effort, server-side refusal fallback, 30 s timeout, 10 calls per minute).
    - `FallbackContentDraftProvider` falls back to rules with a note and records the integration state.
  - `ContentStudioService`:
    - generate, reject;
    - edit, which saves a new version and supersedes the earlier one;
    - approve, in one transaction: refuses stale drafts and failing checks, updates the catalog and writes one `catalog_audit_events` row per changed field, attributed to the merchant and draft version.
  - `/admin/products/[id]/content`:
    - drafting mode and status, the facts panel and generate;
    - for the latest draft: source label, checks, diff, edit form, and approve (shown only when the checks pass and the draft is current) or reject;
    - version history.
  - The product editor links to the studio and labels SEO changes in its history. The storefront product meta description uses the SEO description, falling back to the summary.
- **Bug found and fixed:** the rules draft lowercased the first letter of the materials, which would have produced "fSC-certified". Acronyms now keep their case, with a unit test.
- **Checks:** `npm run lint` pass · `npm run typecheck` pass · `npm test` pass (21 files, 211 tests, including "rules drafts pass every check for all 28 seeded products") · `npm run build` pass · `npm run test:e2e` pass (66 tests: 33 specs × desktop/mobile) · `next dev` smoke check with no API key (studio 307 to login; product meta falls back to the summary). No paid API calls were made.
- **Journey status:** Journey 4 is complete (advisor #11 and Content Studio #12). All four mandatory journeys are now ticked.
- **PR:** [#30](https://github.com/harryfisher18/mero-moss-commerce/pull/30)
- **Next:** the P1 backlog. #23 is the open bug (collection shell and revalidation), then #10 (Upgrade Lab) and #13–#17.

## 2026-11-08: Issue #11, AI Shopping Advisor (M3, Journey 4a)

- **Previous cycle:** #9 merged as `cbedc54` (PR #28) through auto-merge.
- **Issue:** [#11](https://github.com/harryfisher18/mero-moss-commerce/issues/11), the AI Shopping Advisor grounded in catalog data, with a no-key fallback and escalation.
- **Implemented:**
  - Domain (`src/domain/advisor`, pure):
    - Query parsing: budgets in minor units (ranges, ceilings, floors, "around"; units like "30 days" or "750 ml" are not prices), categories, catalog option values, keywords, policy topics, sale, compare and escalation intents.
    - Deterministic retrieval over active, in-stock variants. Sold-out requests are reported, weak partial matches are pruned, and unmatched keywords are relaxed only when other constraints exist.
    - Answer composition from catalog rows and stored policy text only.
    - A wording validator that rejects new prices, percentages, codes, links, contact details and unsupported "free" claims.
  - Migration 7 adds `support_requests`.
  - `RecommendationProvider`: `CatalogRecommendationProvider` is the no-key baseline. Optional `AnthropicWordingProvider` (official SDK, `claude-opus-5-5`, low effort, server-side refusal fallback, 15 s timeout, 20 calls per minute) only rewords validated facts. The integration state is tracked from real calls (DEMO, CONFIGURED, CONNECTED_VERIFIED, ERROR).
  - Storefront `/advisor` with a GET form (works without JavaScript), variant cards at current price and stock, verbatim policy quotes, honest notes and a "Talk to a person" form. It is linked from the header, product pages and the cart.
  - Merchant `/admin/support` lists requests and shows the advisor integration state.
- **Bug found by E2E and fixed:** the ask form was a Suspense fallback that the streamed content replaced, so text typed before streaming finished was lost and an empty question was submitted. The form now renders once outside Suspense, and the answer shows "You asked: …".
- **Bug found by CI and fixed:** adding Requests to the merchant nav made the non-wrapping console header wider than a phone screen, putting Sign out off-screen on mobile. The nav now wraps, and the admin E2E asserts there is no horizontal page overflow and that Sign out is in the viewport.
- **Checks:** `npm run lint` pass · `npm run typecheck` pass · `npm test` pass (19 files, 192 tests) · `npm run build` pass · `npm run test:e2e` pass (62 tests: 31 specs × desktop/mobile) · `next dev` smoke check pass with `ANTHROPIC_API_KEY` forced empty (advisor 200 with grounded prices, `/admin/support` 307 to login). No paid API calls were made.
- **Journey status:** Journey 2 is now complete (the advisor shows the merchant's new price and hides the sold-out variant, E2E). Journey 4 steps 1 and 4 are done; steps 2 and 3 (content drafts and approval) follow with #12.
- **PR:** [#29](https://github.com/harryfisher18/mero-moss-commerce/pull/29)
- **Next:** #12, the AI Content Studio (Journey 4b).

## 2026-11-08: Issue #9, durable order automation (M2, Journey 3)

- **Previous cycle:** #8 merged as `40c3cb4` (PR #27) through auto-merge.
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
- **PR:** [#28](https://github.com/harryfisher18/mero-moss-commerce/pull/28)
- **Next:** #11, the AI Shopping Advisor grounded in catalog data (Journey 4; it also completes the AI part of Journey 2).

## 2026-11-07: Issue #8, merchant product editor (M2, Journey 2)

- **Previous cycle:** #6 and #7 merged as `a9c3df9` (PR #26) through auto-merge. M1 is complete.
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

- **Previous cycle:** #5 merged as `6409ec8` (PR #25) through auto-merge. Both checks were green on main.
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

- **Previous cycle:** #4 merged as `18d0ff1` (PR #24) through auto-merge. Both checks were green on main.
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

- **Previous cycles:** #3 merged as `59b62f3` (PR #20). PR #22 (`5ea05e0`) was the first auto-merge through the protected `main`.
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

- **Visibility:** the owner made the repository **public**. Before relying on that, I scanned all git history for tokens, private keys, `.env` and database files and found none.
- **Protection applied:** `main` requires a PR and both CI checks (strict, up to date), with linear history, conversation resolution, no force pushes or deletions, enforced for admins, and 0 required approvals. Auto-merge, secret scanning and push protection are enabled.
- **Next:** #4, the cart.

## 2026-11-06: Issue #3, product detail page (M1)

- **Previous cycle:** issue #2 merged as `2d17962` (PR #19). Both CI jobs were green on main.
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

- **Previous cycle:** issue #1 merged as `c5892f8` (PR #18). CI was green on main.
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
