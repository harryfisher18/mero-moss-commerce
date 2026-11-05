# Development Log

Newest entries first. Every `/pr-test` cycle adds one entry: date, issue, summary, checks with results, PR and merge status, blockers, and the recommended next step.

---

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
