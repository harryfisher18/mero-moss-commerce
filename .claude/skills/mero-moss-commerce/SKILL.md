---
name: mero-moss-commerce
description: "Build Mero & Moss: a production-minded, end-to-end ecommerce product that lets prospective freelance clients recognize their own project needs in a working storefront, merchant console, and AI/integration workflows. Based on November 2026 client briefs."
argument-hint: "[build|audit|adapt|research|extend] [requirements or repository]"
disable-model-invocation: true
---

# Mero & Moss — Claude Code Ecommerce Build Skill

**Market baseline:** 2026-11-05 | **Target buyers:** US/international freelance ecommerce clients | **Implementation default:** Shopify-first, modular architecture.

## Mission — the buyer must recognize their own project

You are a principal ecommerce product engineer, Shopify integrator, storefront UX specialist, and technical delivery lead. Build a **real, cohesive, client-ready ecommerce product**, not a portfolio website, a page of services, a disconnected feature gallery, a generic Shopify clone, or a static prototype.

**Underlying business objective:** A client considering new ecommerce store development, redesign/CRO, AI integration, automation, marketing workflows, or custom Shopify app development should be able to interact with **Mero & Moss** and reasonably conclude: "This developer can build the system I am planning." Earn that belief with end-to-end working behavior, credible engineering, polished design, understandable business results, and transparent boundaries—not slogans or fictitious claims.

This project is **not** intended merely to look impressive in a portfolio. Its most important quality is **transferability**: customers should recognize their requirements in a finished, adaptable product. It must function as a real software system and be decomposable into actual freelance deliverables.

**Product:** Mero & Moss, a consumer-facing direct-to-consumer ecommerce brand for thoughtfully designed home and everyday essentials, with a genuinely working customer storefront, merchant operations console, and AI/integration layer operating behind the scenes. One cohesive fictional retailer runs across all three surfaces. Build Shopify-first, while protecting core domain logic behind portable interfaces so future WooCommerce or custom-stack work is plausible. Do **not** market unimplemented platforms as supported.

**What a visitor must see:**
1. A convincing, responsive online shop with category navigation, search/filter/sort, real product/variant data, product detail, cart, and demonstrable checkout-to-order flow.
2. A merchant console where product edits, orders, customer support, conversion opportunities and automation are visible and actually affect the shop.
3. AI features integrated into real ecommerce tasks: product discovery/support and/or AI-assisted catalog content, grounded in data, with human controls.
4. A clear before/after storefront improvement scenario and one reliable order/integration workflow.
5. Specific services this codebase can be customized to deliver, without claiming to have served fictitious clients.

**Important scope distinction:** In local demo mode, checkout creates **SIMULATED ORDERS ONLY**, with a prominent no-payment disclosure. In connected Shopify mode, hand off payment to supported Shopify checkout. Never fabricate payment processing or claim Shopify connectivity unless verified on an authorized development store.

## Invocation

Use `$ARGUMENTS` to pick mode. If none are supplied, choose `build`.

- `build`: implement the working product in the repository and run all feasible tests; do not stop at planning or mockups.
- `audit`: examine an existing ecommerce app/store/codebase, compare against the client-proof acceptance criteria, and propose a prioritized actionable improvement plan.
- `adapt <client brief>`: turn an actual buyer's requirements into a scoped enhancement. Keep the client's existing brand and system. Implement safe parts, obtain approval for live writes.
- `extend <module>`: add one well-tested vertical slice; do not build an isolated decorative widget.
- `research`: refresh dated demand evidence, with job URLs and a reproducible sampling method if making any frequency claim; update priorities.

Always inspect the repository and current git status before changes. Do not overwrite uncommitted work. If the project already exists, improve it rather than regenerating it.

## 1. Demand assessment — do not confuse fastest growth with highest job volume

Read `references/MARKET_BRIEF_2026-11-05.md` and `references/CLIENT_BRIEF_TO_FEATURE_MATRIX.md`.

- Upwork's Feb 2026 study ranks **Ecommerce Website Development** among top ten coding/web development skills by measured freelancer earnings; **AI Integration +178%** and **AI Chatbot Development +71%** are fastest-growing skills in that category. Its data measures **US-origin contracted earnings during 2025** against 2024, not November 2026 counts, and not Shopify-only percentages.
- Recent direct buyer briefs include Shopify theme redesign/mobile CRO and speed, genuine new store functionality, AI-enabled product/SEO content with approvals, live-catalog AI assistants, order/CRM/marketing integrations, and tracking QA.
- A Sept 2026 Upwork monthly report also describes sustained demand for AI implementation and workflow automation. These are directional signals; no defensible worldwide precise ordering of project types is available from this evidence.

### Product design priority (editorial decision, NOT a statistical demand ranking)

| Priority | Buyer contract class | What this product must prove |
|---|---|---|
| P0 | Build or modernize a functional online store | Excellent mobile storefront, real interactions, data coherence, variants, cart, order flow |
| P0 | Improve existing Shopify UX/CRO | Before/after product/cart experience, theme-safe modular enhancements, performance discipline |
| P0 | Shopify API, integration and app engineering | Products/orders sync, webhooks, auth boundaries, durable automation, visible failures |
| P0 | Applied AI for ecommerce | Grounded product assistant and AI catalog draft with explicit approval; never invented price/stock |
| P1 | Customer lifecycle automation | Segmented cart/welcome/post-purchase journey preview, consent gates, optional Klaviyo adapter |
| P1 | Analytics and tracking | Real app events, funnel instrumentation, explain limitations; optional verified GA4/Meta integrations |
| P2 | WooCommerce, ERP, B2B, subscription, wholesale | Scope examples and adapter seams, implement only when required by a buyer or after MVP |

Do NOT favor AI gimmicks over a credible end-to-end shopping experience. Do NOT claim these categories are definitively the most frequently purchased without representative marketplace data.

## 2. Product concept and UX

**Official project / retail brand name:** `Mero & Moss` — a fictional premium-but-approachable DTC home & everyday-living retailer. Its actual business is selling considered everyday essentials, not developer services or software tools. Product categories: home organization, table & kitchen, workspace accessories, and travel-ready everyday essentials. Use coherent original merchandising with product families, variants, prices, stock, policies, lifestyles, and currency. Seed 24–40 original plausible items with genuine categories, variants, prices, inventory, descriptions and synthetic orders. Mark demo data visibly where relevant; never claim fictitious customer reviews or sales.

**Customer-facing identity rules:** The public masthead, store title, receipts, cart, email previews, customer care copy and metadata all say `Mero & Moss`. Never show `CommerceFlow`, `GrowthOps`, `Studio`, `Builder`, `AI platform`, `Portfolio`, or `Developer showcase` to shoppers. The home page sells products and expresses a retailer's identity: *"Well-made essentials for everyday living."* Merchant operations belong behind authenticated `/admin` routes. The optional before/after demo and client requirement explanation belong in merchant/demo-only views and must not interrupt a normal shopper journey. Use a restrained, warm, editorial visual system rather than a generic SaaS dashboard theme. Domain availability or trademark clearance is NOT implied by this fictional project name.

**Navigation surfaces:**

### Surface A — Customer Store (primary visual landing)

Build a real mobile-first shopping experience, not just a sample listing under an admin dashboard:

- Home with cohesive editorial direction, product collections, trust/FAQ/policies, search, responsive navigation, featured products and genuine CTAs.
- Collection pages with working filters, sorting, pagination, empty states, and stable URL query parameters.
- Product detail with selectable variants, up-to-date price/availability, correct media, shipping/returns statements sourced from stored demo policies, quantity, sticky or prominent add-to-cart, related products.
- Cart with edit quantity/remove, totals in minor monetary units with currency, validation of variant stock, retained state, clear shipping/tax estimate caveat (no unverified shipping promise).
- Explicit local `DEMO CHECKOUT` that creates a simulated order in the same local domain model and displays order summary. No real credit card forms, no live charges. In Shopify-connected mode, use official supported Shopify cart/checkout handoff and verify in a development store.
- AI Shopping Advisor embedded in collection/product/cart flows: budget/intents, compare items, link to actual variants, accurate policy/stock info, fallback search and human escalation. Retrieval and constraints provide factual grounding; LLM is optional.
- Accessibility and speed: semantic structure, navigation with keyboard, mobile viewport, reduced motion support, meaningful image alt text, usable focus styling, performant assets.

### Surface B — Merchant Console (same data as customer store)

- Overview with **recorded and clearly tagged demo metrics**, no invented revenue lift or charts with fake baselines.
- Products/variants manager: edit price/stock/details; preview and publish DEMO changes. Connected merchant production writes require consent, authorization, scope checks, preview, audit log and explicit confirmation.
- Orders: new simulated order appears immediately; status management, fulfillment preview, order detail and review queue. Shopify order APIs if actually connected and authorized.
- Automations: show durable lifecycle, event payload preview with redacted personal data, retries/dead letter, idempotency, clear states and integration mapping.
- AI Content Studio: generate a product title/SEO description draft using product facts; human review + diff + approval; without an LLM key provide deterministic editable sample-generation or rules-based enhancement clearly labeled. Publish only to demo data unless authorized.
- Analytics/Funnel: track actual demo session events and illustrate add-to-cart/checkout events from recorded data, not arbitrary mock numbers. Distinguish synthetic demo from analytics collected on a real store.
- Integrations: demo/live connection health with honest status, Shopify and optional n8n/Klaviyo/Slack adapters; no inert 'Connect' button.
- Merchant settings and branding, demo reset, and explanations of which upgrades can be applied to an existing store.

### Surface C — Upgrade Lab (buyer recognition)

Show a **credible same-product before/after comparison** for three specific improvement briefs:

1. Mobile product page: cluttered/unclear variant and add-to-cart vs improved hierarchy, CTA, trust/policy links, accessible variant state.
2. Product discovery: basic keyword result vs grounded conversational recommendations with actual products and stock.
3. Manual order operations: unstructured incoming order vs event-driven routing, review, notification preview and replayable job log.

The 'before' mode must be explicitly **illustrative**, not claimed to be an actual previous client site or measured production improvement. Make comparisons functional and rooted in the same catalog/order fixture. Avoid fabricated before/after percentage lifts, performance scores, reviews or testimonials.

## 3. Four mandatory end-to-end user journeys

Do not mark the product complete unless all four journeys work without paid keys in local demo mode:

**Journey 1 — Shopper to order**
1. Shop from homepage -> collection -> filter -> product -> choose in-stock variant -> add to cart.
2. Update quantity, review totals, complete clearly labeled simulation checkout.
3. Receive simulated order ID and accurate summary; see the same order in Merchant Console.
4. Invalid variants and out-of-stock quantities cannot produce orders.

**Journey 2 — Merchant change propagates**
1. Edit product stock and price in merchant console and save to demo catalog.
2. Revisit the storefront and AI assistant; both reflect the new values and stock.
3. AI cannot invent missing policies, discounts or prices. Verify via tests.

**Journey 3 — Order automation is real**
1. New simulated order emits a domain event; connected Shopify receives verified webhook (if configured).
2. Durable worker normalizes event, assigns appropriate routing/review tag, logs notification preview.
3. Replay same event ID is idempotent; forced failure retries with bounded exponential backoff, surfaces operator action.
4. Live side effects to external providers are disabled by default; explicit merchant authorization required.

**Journey 4 — AI-enhanced business workflow**
1. Shopper asks for a real filtered comparison and sees accurate catalog-grounded recommendations.
2. Merchant generates an SEO/content proposal for an existing item, inspects factual constraints and approves a preview.
3. In demo mode only, approved draft updates the storefront item with an audit trail.
4. No key or model outage -> functional deterministic fallback and clear status, not a broken interface.

### Additional merchant-facing demonstration (not a fifth required backend subsystem)

Show `Upgrade Lab` before/after UX and performance checklist with real DOM/page measurements only where available. If measuring Core Web Vitals/Lighthouse, run actual tools and record device/network assumptions. Do not display invented wins.

## 4. Engineering architecture

Choose the right architecture for the repository. If starting fresh, prefer strict TypeScript with a server-rendered modern React frontend, typed API, SQL database, migrations, unit/E2E tests, and deployable workers. **Prioritize coherent working software over a fashionable framework stack.**

Suggested modules (logical separation, not necessarily separate services):

```text
apps/storefront       Customer site + grounded shopping assistant
apps/merchant         Merchant console, content approvals, upgrades
packages/commerce     Product, variant, price, inventory, cart, order rules
packages/integrations Shopify, AI, messaging, marketing adapters
packages/events       Transactional outbox, webhook inbox, job processor
packages/ui           Shared accessible components/design tokens
```

Possible implementation: Next.js/React + TypeScript, PostgreSQL + Prisma, server-authorized routes, a DB-backed durable outbox/worker, Vitest, Playwright. For official Shopify embedded admin app, use Shopify's current supported scaffold and extension guidance, not an invented OAuth or unsupported API version. Theme Liquid skills/blocks may belong in a separate `shopify-theme` package. Avoid forcing a generic custom checkout into Shopify.

Interfaces required:
- `CommerceRepository`: catalog, variants, inventory, orders, checkout simulation.
- `StorePlatformAdapter`: demo + authorized Shopify implementation; future WooCommerce seam only.
- `RecommendationProvider`: retrieval/rules baseline; optional LLM wording using validated retrieval.
- `ContentDraftProvider`: factual input, human review, versioned drafts.
- `EventBus/JobQueue`, `NotificationProvider`, `MarketingProvider` with explicit demo/live behavior.

Multi-tenant isolation for merchant data; integer minor currency units and ISO currency codes; UTC timestamps; server-side authorization; secure session; rate limits; schema validation and sanitization; secret encryption; data minimization and retention. Do not expose API keys in browser or logs.

Shopify specifics when enabled: official managed installation and required minimal scopes, authorized store only, GraphQL APIs, cursor pagination, version compatibility check, webhook HMAC over raw body, timing-safe compare, deduplication, retries and reconciliation. Respect protected customer-data restrictions. Use theme app extensions or unpublished theme work for storefront enhancements and leave native checkout untouched. Every live product publish, fulfillment message, refund or customer communication needs explicit approval; never perform live destructive writes based on an AI suggestion.

Never fake integrations. `DEMO`, `CONFIGURED`, `CONNECTED & VERIFIED`, and `ERROR` must be separate states. Network errors and missing credentials must degrade gracefully. Real Shopify, Klaviyo, GA4, Meta, n8n and WooCommerce integrations are optional and not claimed to work until tested with permission.

## 5. Build sequence — complete one vertical slice before expanding

**Phase 0 — Repo audit and customer-needs map**
- Inspect current files, git diff/status, setup, services, package scripts and existing tests; preserve work.
- Read market and buyer-job matrix references. Record assumptions and boundaries in `PROJECT_BRIEF.md`.
- Create `TASKS.md` with clear build order and verifiable acceptance criteria.

**Phase 1 — A complete commerce loop (MUST FINISH FIRST)**
- Build consistent Mero & Moss customer storefront and seeded merchandise.
- Implement variant-aware catalog, search/filter, cart, simulated checkout, order persistence and merchant orders view.
- Implement the same currency, inventory and order rules on both surfaces. Unit and E2E test the whole loop.
- Ensure visually polished mobile/desktop UI, no dead controls, valid routes and clear demo status.

**Phase 2 — Observable commerce operations**
- Product editor that genuinely propagates to storefront; durable order event processing; routing and notification previews; retry/idempotency and job inspection.
- Add before/after Upgrade Lab with genuinely interactive product/cart flow.

**Phase 3 — Applied AI, anchored to commerce data**
- Shopping Advisor with factual catalog retrieval, budget/product comparison and no-key fallback.
- Product content/SEO draft approval; safe controlled publish into demo catalog only.
- Test hallucination safeguards, outdated stock responses, prompt injection in catalog text, escalation and price consistency.

**Phase 4 — Platform adapters / optional buyer modules**
- If authorized Shopify dev store exists, implement official install, catalog sync, theme extension, webhook verification and supported checkout. Verify against the dev store and record test output.
- Optional single connector chosen by evidence: Klaviyo or n8n/Google Sheets or GA4; test sandbox/dry-run first. Do not implement all integrations superficially.
- Make upgrade modules removable without breaking existing Shopify theme/store operations.

**Phase 5 — Release checks and business-facing demo**
- Run lint, typecheck, tests, E2E, accessibility checks and production build; actually fix discovered errors.
- Document exact command and status; label any unrun test or unavailable live integration.
- Prepare a clear buyer-facing tour of working features and the specific common order types they prove.

## 6. Deliverables

Produce actual working source code **and**:

- `README.md` — value to merchants, not claims about a developer's credentials; screenshots if actually captured, setup, env, scripts and data reset.
- `PROJECT_BRIEF.md` — target buyer, market evidence, differentiated product promise and non-goals.
- `FEATURE_TO_CLIENT_REQUEST.md` — map each feature to a plausible freelance brief and indicate demo/real/phase-2 status.
- `TASKS.md` — milestones with accurate done/not-done statuses.
- `DEMO_TOUR.md` — buyer can explore customer shop → order → merchant console → automation → AI → Upgrade Lab in 3–5 minutes, with exact working click paths.
- `SERVICE_ADAPTATIONS.md` — how this system could be customized into (a) new Shopify store, (b) store redesign/CRO, (c) Shopify embedded app, (d) AI shopping assistant, (e) order automation, (f) lifecycle marketing; distinguish implemented from projected modules.
- `INTEGRATION_STATUS.md` — actual state, permissions, tests, missing credentials, rollback and limitations.
- `TEST_RESULTS.md` — commands actually run, pass/fail logs or concise summaries, honest coverage gaps.
- `.env.example`, schema/migrations, fixtures, tests, sample webhook events and practical deployment notes.

A product marketing/sales demo can be built **inside the product** as an accessible `Explore capabilities` entry, but not a separate portfolio landing page full of unverifiable claims. Workflows should explain themselves through interaction.

## 7. Hard acceptance gates

- [ ] User can browse, filter, select variant, add to cart and place a clearly labeled simulated order without external keys.
- [ ] The resulting order immediately appears in authenticated merchant order view; totals, inventory and variants are consistent.
- [ ] Storefront is beautiful and usable on mobile and desktop; no dead links/buttons, credible loading/empty/error states.
- [ ] Merchant changing product price/stock updates product page, cart checks and AI suggestions.
- [ ] Real persisted order event -> worker -> review/notification preview; duplicate event replay does not double-run effects; failures are inspectable.
- [ ] AI shopping answer matches available catalog and policy, works without an LLM key, does not leak customer data, and provides escalation.
- [ ] AI content edits require merchant review before application; all demo changes are logged.
- [ ] Upgrade Lab is interactive and explicitly illustrative, with no fake measured uplift.
- [ ] No live payments, sends, product publishing, fulfillment or refunds without explicit authorized permission.
- [ ] Verified integrations are distinguished from simulated ones; unverified connectors are never represented as working.
- [ ] Tests, lint, production build and E2E were actually run, with results and limitations documented.
- [ ] Final product convincingly maps onto several **specific** customer order families; not just an AI widget, dashboard or generic template.

## 8. Strict anti-patterns

No generic dropshipping clone, disjointed admin widgets, fictional testimonials, fabricated screenshots of production metrics, claimed revenue increases, invented demand rankings, unsafe fake payment forms, secret-spilling demo, hard-coded fake buttons, autonomous refund/fulfillment actions, or marketing-email sending without valid consent.

Do not let optional features displace working checkout/order fundamentals. Optimize for a **finished and trustworthy product**, not feature count.

## Official docs to verify at build time

- Shopify dev center: https://shopify.dev/docs
- Shopify app scaffolding: https://shopify.dev/docs/apps/build/scaffold-app
- Shopify auth: https://shopify.dev/docs/apps/build/authentication-authorization
- Theme app extensions: https://shopify.dev/docs/apps/build/online-store/theme-app-extensions
- Webhook verification: https://shopify.dev/docs/apps/build/webhooks/verify-deliveries
- Shopify Admin GraphQL: https://shopify.dev/docs/api/admin-graphql/latest
- Claude Code skills: https://code.claude.com/docs/en/skills

**Final instruction to Claude:** Start by inspecting the current repository and stating a brief product-level execution plan. Then implement end-to-end, prove the mandatory journeys with automated tests, and clearly report what is working versus unverified. Never stop after producing architecture notes, templates or promotional copy when the task is `build`.
