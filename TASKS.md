# Mero & Moss — Roadmap and Task Status

Milestones follow the build sequence in `.claude/skills/mero-moss-commerce/SKILL.md` §5. Complete one vertical slice before expanding. Each item maps to a GitHub issue, and the issue numbers are filled in once created. Status is updated by every `/pr-test` cycle. Only tick an item when it is merged into `main` with passing checks.

Legend: `[x]` merged · `[ ]` not done · `(#n)` GitHub issue

## M0 — Engineering foundation

- [x] Repository bootstrap: Next.js 16 + strict TypeScript, ESLint, Vitest, CI workflow, `/pr-test` skill, CLAUDE.md, roadmap
- [x] Branch protection on `main`: PR required, both CI checks required and up to date, linear history, no force pushes or deletions, enforced for admins; auto-merge and secret-scanning push protection enabled (repo made public on 2026-11-07)

## M1 — Complete commerce loop (P0, must finish first)

- [x] Catalog domain model, SQLite persistence and seeded Mero & Moss catalog with storefront home (#1)
- [x] Collection pages with filters, sorting, pagination and stable URL params (#2)
- [x] Product detail page with variant selection, availability and stored policies (#3)
- [x] Cart with persisted state, quantity edits, stock validation and totals in minor units (#4)
- [x] Collection page shell must survive path revalidation (#23, P1 bug found during #4)
- [x] Demo checkout that creates simulated orders and decrements inventory atomically (#5)
- [x] Merchant authentication and orders console (`/admin/orders`) (#6)
- [x] Playwright E2E for Journey 1 (shopper to order) running in CI (#7)

## M2 — Observable commerce operations (P0)

- [x] Merchant product editor (price, stock, details) that propagates to the storefront, with an audit log (Journey 2) (#8)
- [x] Durable order event outbox and worker: routing tags, notification preview, idempotent replay, bounded retries, dead letter, job inspector (Journey 3) (#9)
- [x] Upgrade Lab: interactive, clearly illustrative before/after for product page, discovery and order operations (#10)

## M3 — Applied AI grounded in commerce data (P0)

- [x] AI Shopping Advisor: catalog-grounded retrieval, budget/compare, deterministic no-key fallback, human escalation, injection safeguards (Journey 4a) (#11)
- [x] AI Content Studio: factual product content drafts, diff, merchant approval, demo publish with audit trail (Journey 4b) (#12)

## M4 — Analytics, lifecycle and integrations (P1)

- [x] First-party analytics events and funnel view built from recorded demo sessions (#13)
- [x] Integrations status with honest `DEMO` / `CONFIGURED` / `CONNECTED_VERIFIED` / `ERROR` states and a `StorePlatformAdapter` Shopify seam (#14)
- [x] Consent-gated lifecycle journey previews (welcome, abandoned cart, post-purchase) (#15)

## M5 — Release readiness (P1)

- [x] Accessibility (axe) and performance checks in CI with recorded results (#16)
- [x] Buyer-facing docs: DEMO_TOUR, SERVICE_ADAPTATIONS, FEATURE_TO_CLIENT_REQUEST, INTEGRATION_STATUS, TEST_RESULTS (#17)

## Remaining from the product requirements (P2)

- [x] Sample webhook events and practical deployment notes (#47)
- [x] Order review queue and fulfillment preview (#51)
- [ ] Storefront product search
- [ ] Merchant overview page with recorded, labelled demo metrics
- [ ] Merchant settings and in-console demo reset
- [ ] Verify the Shopify adapter against an authorized development store (#49, blocked: needs a store and credentials from the owner)

## Mandatory journeys (acceptance gates)

- [x] Journey 1 — Shopper to order (#7)
- [x] Journey 2 — Merchant change propagates (#8, advisor part #11)
- [x] Journey 3 — Order automation is real (#9; #14 adds webhook signature verification, while receiving Shopify webhooks needs an authorized development store)
- [x] Journey 4 — AI-enhanced business workflow (#11 advisor, #12 Content Studio)
