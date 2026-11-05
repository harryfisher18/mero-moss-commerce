# Mero & Moss — Roadmap and Task Status

Milestones follow the build sequence in `.claude/skills/mero-moss-commerce/SKILL.md` §5. Complete one vertical slice before expanding. Each item maps to a GitHub issue, and the issue numbers are filled in once created. Status is updated by every `/pr-test` cycle. Only tick an item when it is merged into `main` with passing checks.

Legend: `[x]` merged · `[ ]` not done · `(#n)` GitHub issue

## M0 — Engineering foundation

- [x] Repository bootstrap: Next.js 16 + strict TypeScript, ESLint, Vitest, CI workflow, `/pr-test` skill, CLAUDE.md, roadmap
- [ ] Branch protection on `main` requiring CI (blocked until the `gh` CLI is authenticated as the owner; see DEVLOG)

## M1 — Complete commerce loop (P0, must finish first)

- [ ] Catalog domain model, SQLite persistence and seeded Mero & Moss catalog with storefront home (#1)
- [ ] Collection pages with filters, sorting, pagination and stable URL params (#2)
- [ ] Product detail page with variant selection, availability and stored policies (#3)
- [ ] Cart with persisted state, quantity edits, stock validation and totals in minor units (#4)
- [ ] Demo checkout that creates simulated orders and decrements inventory atomically (#5)
- [ ] Merchant authentication and orders console (`/admin/orders`) (#6)
- [ ] Playwright E2E for Journey 1 (shopper to order) running in CI (#7)

## M2 — Observable commerce operations (P0)

- [ ] Merchant product editor (price, stock, details) that propagates to the storefront, with an audit log (Journey 2) (#8)
- [ ] Durable order event outbox and worker: routing tags, notification preview, idempotent replay, bounded retries, dead letter, job inspector (Journey 3) (#9)
- [ ] Upgrade Lab: interactive, clearly illustrative before/after for product page, discovery and order operations (#10)

## M3 — Applied AI grounded in commerce data (P0)

- [ ] AI Shopping Advisor: catalog-grounded retrieval, budget/compare, deterministic no-key fallback, human escalation, injection safeguards (Journey 4a) (#11)
- [ ] AI Content Studio: factual product content drafts, diff, merchant approval, demo publish with audit trail (Journey 4b) (#12)

## M4 — Analytics, lifecycle and integrations (P1)

- [ ] First-party analytics events and funnel view built from recorded demo sessions (#13)
- [ ] Integrations status with honest `DEMO` / `CONFIGURED` / `CONNECTED_VERIFIED` / `ERROR` states and a `StorePlatformAdapter` Shopify seam (#14)
- [ ] Consent-gated lifecycle journey previews (welcome, abandoned cart, post-purchase) (#15)

## M5 — Release readiness (P1)

- [ ] Accessibility (axe) and performance checks in CI with recorded results (#16)
- [ ] Buyer-facing docs: DEMO_TOUR, SERVICE_ADAPTATIONS, FEATURE_TO_CLIENT_REQUEST, INTEGRATION_STATUS, TEST_RESULTS (#17)

## Mandatory journeys (acceptance gates)

- [ ] Journey 1 — Shopper to order
- [ ] Journey 2 — Merchant change propagates
- [ ] Journey 3 — Order automation is real
- [ ] Journey 4 — AI-enhanced business workflow
