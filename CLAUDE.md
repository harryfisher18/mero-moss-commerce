# MERO & MOSS — Engineering Guide for Claude Code

@AGENTS.md

Mero & Moss is a fictional direct-to-consumer retailer of well-made home and everyday essentials. This repository is a **working e-commerce product** (customer storefront, merchant console, AI and automation layer) that must stay production-minded and honest. It is not a developer portfolio, a SaaS dashboard theme, or a feature gallery.

## Source of truth

| What                                                            | Where                                                       |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| Product requirements, journeys, acceptance gates, anti-patterns | `.claude/skills/mero-moss-commerce/SKILL.md`                |
| Market evidence and buyer-to-feature matrix                     | `.claude/skills/mero-moss-commerce/references/`             |
| Roadmap, milestones, done / not-done status                     | `TASKS.md`                                                  |
| Product promise, assumptions, non-goals                         | `PROJECT_BRIEF.md`                                          |
| Per-run development log (newest first)                          | `docs/DEVLOG.md`                                            |
| Daily autonomous workflow                                       | `.claude/skills/pr-test/SKILL.md` (invoked with `/pr-test`) |

Do not edit the files under `.claude/skills/mero-moss-commerce/` except to refresh the market brief through its `research` mode. They are the original requirements.

## Non-negotiable product rules

- Shoppers only ever see the **Mero & Moss** brand. Never show "CommerceFlow", "Studio", "Builder", "AI platform", "Portfolio", or "Developer showcase" on customer-facing surfaces.
- Merchant operations live behind authenticated `/admin` routes. Upgrade Lab and capability explanations are merchant/demo-only.
- Local DEMO mode must work end-to-end with **no external API keys**.
- Checkout in DEMO mode creates **simulated orders only**, with a prominent no-payment disclosure. Never add card forms or real payment processing.
- Never fabricate metrics, reviews, testimonials, revenue lifts, integration status, or measurements. Demo data is visibly labeled.
- Integration states are distinct: `DEMO`, `CONFIGURED`, `CONNECTED_VERIFIED`, `ERROR`. Never show an unverified connector as working, and never ship an inert "Connect" button.
- AI features are grounded in catalog/policy data. They must never invent prices, stock, discounts, or policies, and must have a deterministic no-key fallback.
- No live side effects (payments, emails, Shopify writes, fulfillment, refunds) without explicit, separate authorization.

## Architecture

Single Next.js App Router application (strict TypeScript) with logical module boundaries. Keep these boundaries even though everything ships as one deployable.

```text
src/app/(store)/        Customer storefront routes (public)
src/app/admin/          Merchant console (authenticated)
src/app/api/            Route handlers (webhooks, JSON APIs)
src/domain/commerce/    Pure domain rules: money, catalog, variants, inventory, cart, orders (no I/O)
src/domain/events/      Domain event types, outbox and job state machine (pure)
src/server/db/          SQLite access (node:sqlite), migrations, seed
src/server/repositories CommerceRepository and other persistence-backed interfaces
src/server/integrations StorePlatformAdapter, RecommendationProvider, ContentDraftProvider, notification/marketing adapters
src/components/         Shared, accessible UI components and design tokens
tests/e2e/              Playwright end-to-end journeys
```

- **Persistence:** SQLite through Node's built-in `node:sqlite` (Node >= 24), so there are no native build steps. The DB file lives in `.data/` (gitignored). All SQL goes through repository modules behind interfaces, so a PostgreSQL implementation stays possible. Schema changes go in versioned migrations under `src/server/db/migrations/`.
- **Money:** integer minor units plus an ISO 4217 currency code. Never use floats for money. Timestamps are UTC ISO strings.
- **Validation:** validate every external input (forms, route handlers, server actions, webhooks) with `zod` at the boundary.
- **Next.js 16 with `cacheComponents: true`:** data access is dynamic by default. Synchronous SQLite reads must call `await connection()` (from `next/server`) first, and dynamic UI must be wrapped in `<Suspense>`. Read `node_modules/next/dist/docs/` before using an unfamiliar Next API. Do not rely on memory of older Next.js versions.
- **Server Actions** must re-check authorization and validate input. They are publicly reachable POST endpoints.
- **Secrets** only come from environment variables (document every variable in `.env.example`). Never send them to the browser or write them to logs.

## Engineering standards

- Strict TypeScript. No `any`, and no `@ts-ignore` or `eslint-disable` without a written justification comment.
- Domain logic stays pure and unit-tested. UI components stay thin.
- Accessible by default: semantic HTML, labelled controls, keyboard navigation, visible focus, `prefers-reduced-motion`, meaningful `alt` text.
- Mobile-first, restrained, warm editorial visual style. No generic SaaS dashboard look on the storefront.
- No dead links or buttons. Every control does something real or is not rendered.
- Prefer small, focused changes. No speculative features or unrelated refactors.
- All code, comments, UI copy, docs, issues, commits and PRs are in **English**.

## Commands

```bash
npm run dev          # local dev server (http://localhost:3000)
npm run lint         # ESLint + Prettier check
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit/integration tests
npm run test:e2e     # Playwright E2E against a production build: run `npm run build` first; `npx playwright install chromium` once. Uses an isolated .data/e2e.db
npm run build        # production build
npm run check        # lint + typecheck + test + build (what CI runs)
npm run db:reset     # recreate the local demo database from seed data
npm run merchant:hash -- "<password>"  # scrypt hash for MERCHANT_PASSWORD_HASH
npm run worker       # standalone outbox worker (scheduled retries); `-- --once` processes due jobs and exits
```

Never weaken, skip, or delete checks or tests to get green. Fix the root cause.

## Git and GitHub workflow

- Default branch: `main`. Never commit directly to `main` after the initial bootstrap. All work goes through a PR.
- Branches: `feat/issue-<n>-<slug>`, `fix/issue-<n>-<slug>`, `chore/issue-<n>-<slug>`, `docs/issue-<n>-<slug>`.
- Commits: Conventional Commits (`feat(storefront): ...`, `fix(cart): ...`, `test: ...`, `ci: ...`, `docs: ...`, `chore: ...`). Commit author is the repository owner (harryfisher18). Every commit, including squash-merge commits, ends with two co-author trailers: `Co-authored-by: Harry Fisher <harryfisher1890@gmail.com>` and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Add no other co-authors, and no AI attribution in PR descriptions.
- PRs: summary, `Closes #<n>`, tests performed with results, risks and follow-ups. Squash-merge and delete the branch.
- Git transport: SSH via the host alias `github-harry` (identity `harryfisher18`, the repository owner). The `gh` CLI must be the **harryfisher18** account for labels, protections and merges. Check with `gh api user --jq .login` and switch with `gh auth switch --user harryfisher18`.
- Never force-push to `main`, bypass protections with admin rights, fake approvals, or disable checks.
- Stage files explicitly. Never commit `.env*` (except `.env.example`), `.data/`, credentials, or build output.

## Issue labels

`type:feature`, `type:bug`, `type:chore`, `type:docs`, `priority:P0`, `priority:P1`, `priority:P2`, `area:storefront`, `area:merchant`, `area:commerce-core`, `area:ai`, `area:automation`, `area:integrations`, `area:analytics`, `area:infra`, `status:blocked`.
