# Mero & Moss

_Well-made essentials for everyday living._

Mero & Moss is a working e-commerce product for a direct-to-consumer home and everyday-essentials brand. It has a customer storefront, a merchant console, and an AI and automation layer, all sharing one catalog and order model. It runs fully in local **DEMO mode** without any external API keys.

> **Demo boundaries:** checkout in DEMO mode creates **simulated orders only**. No payment is taken and no card details are collected. All products, customers and orders are synthetic demo data. No live integrations are claimed unless they are listed as verified in `INTEGRATION_STATUS.md`.

## What merchants can evaluate

| If you need…                         | Try this in Mero & Moss                                           | Status                                                                        |
| ------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A new or modernized online store     | Storefront browsing, filters, variants, cart, simulated checkout  | Done (M1): browse → cart → simulated checkout → order in the merchant console |
| Order operations without manual work | Order events, routing, retries and replay in the merchant console | Done (#9): durable outbox, worker, job inspector                              |
| Better product discovery             | Catalog-grounded shopping advisor                                 | Done (#11): works with no API key; optional validated LLM wording             |
| AI-assisted catalog content          | Draft → review → approve workflow                                 | Done (#12): versioned drafts, factual checks, audited demo publish            |
| Store redesign / CRO                 | Upgrade Lab before/after comparisons                              | Done (#10): illustrative and interactive, no measured-uplift claims           |

See [TASKS.md](TASKS.md) for the live roadmap and the status of each item.

## Getting started

Requirements: **Node.js 24+** (uses the built-in `node:sqlite`) and npm 11+.

```bash
npm install
npm run dev            # http://localhost:3000 (the demo DB is created and seeded on first request)
npm run db:reset       # recreate the local demo database from seed data
npm run worker         # optional: background worker that runs scheduled automation retries
```

Copy `.env.example` to `.env.local` to override defaults. No variables are required for DEMO mode.

## Shopping advisor

Open [/advisor](http://localhost:3000/advisor) (also linked from the header, product pages and the cart). Ask things like "travel gifts under $50", "linen storage bin in Oat", "compare the felt desk mat and the oak monitor stand" or "what is your return policy?".

- **Grounded by design.** A deterministic parser turns the question into budget, category, option and keyword constraints. Retrieval returns only active, in-stock variants, and every card links to the exact variant at its current price and stock. Policies are quoted word for word from the stored policy text. Sold-out matches are reported, not hidden, and the advisor never invents discounts, codes or policies.
- **No key needed.** Without `ANTHROPIC_API_KEY` the advisor is fully functional on catalog rules (state `DEMO`).
- **Optional assisted wording.** With a key set, the advisor asks Claude (`claude-opus-5-5` by default, overridable with `ADVISOR_MODEL`) to reword the same validated facts. The reply is rejected, and the catalog wording shown instead, if it introduces any price not in the facts, a percentage, a code, a link, contact details or an unsupported "free" claim, or if the call fails, times out or is refused. The integration state (`DEMO`, `CONFIGURED`, `CONNECTED_VERIFIED`, `ERROR`) comes from real calls only and is shown to merchants.
- **Human escalation.** "Talk to a person" saves the shopper's email, message and advisor question for the shop team. No email is sent.

## Merchant console

Open [/admin](http://localhost:3000/admin) to:

- **Overview:** where the console opens. Orders by status, the review queue, stock alerts, automation problems and customer requests, each counted from the database and linking to where it can be acted on. Labelled as demo data, with no targets, trends or forecasts.
- **Orders:** list and filter simulated orders, view detail and history, and move them through placed → processing → fulfilled, or cancel (which restocks). Orders that automation flags wait in a **Needs review** queue and can't start processing until someone clears them. Each order has a fulfillment preview with its routing and pick list; nothing is sent to a warehouse.
- **Products:** edit title, copy, status, price, compare-at price and stock per variant. Changes reach the storefront, cart and checkout on the next request, and every changed field is recorded in the product's change history.
- **Automations:** every order writes an `order.created` event in the same transaction as the order. A worker routes it to a ship zone, flags high-value and bulk orders for review, and records notification previews. **Nothing is sent.** The job log shows each event's status, attempts, redacted payload and previews. Replay is idempotent, failures retry with bounded exponential backoff (10 s, 20 s, 40 s, 1 min 20 s), and the event moves to a dead letter queue after 5 attempts. Two labelled failure drills show retries and dead-lettering on demand.
- **Requests:** "Talk to a person" requests from the shopping advisor, plus the advisor's assisted-wording integration state.
- **Lifecycle:** welcome, abandoned-cart and post-purchase journeys, gated by explicit opt-ins from checkout and the cart page. Consent is checked when each message is prepared and can be withdrawn here. Each message is deduplicated by its triggering event and stored as a preview. **Nothing is sent.**
- **Integrations:** what the store is really connected to, as `DEMO`, `CONFIGURED`, `CONNECTED_VERIFIED` or `ERROR`. Shopify is off by default and has not been verified against a real store. With complete `SHOPIFY_*` settings, a read-only "Verify connection" check becomes available; the adapter has no way to write to Shopify.
- **Analytics:** a funnel (viewed a product → added to cart → began checkout → placed a simulated order) built only from events recorded in this store, labelled as demo-session data. Events hold an anonymous per-browser-session id and catalog facts, never a name, email, address, cart or order. Browsers sending Global Privacy Control are not recorded, and nothing is sent to an outside analytics service.
- **Upgrade Lab:** three interactive before/after comparisons on the live catalog and real orders: the mobile product page, product discovery, and order operations. Every "before" is illustrative and built for this demo; nothing claims a conversion, revenue or speed result. The only measurements are control sizes read from the rendered panels when you press "Measure these panels". The lab never changes a cart or order, and never calls an AI service.
- **Content Studio** (from any product's editor): generate a proposed title, summary and SEO description from the product facts, inspect a word-level diff against the live copy, edit it (each save is a new version), and approve or reject it. Without `ANTHROPIC_API_KEY`, drafts are clearly labelled **rules-based** and assembled only from the facts; with a key, Claude (`claude-opus-5-5` by default, `CONTENT_MODEL` to override) drafts via structured output and falls back to rules on any failure. Every draft, whatever its source, must pass factual checks before approval: no prices, no numbers, percentages or materials that are not in the facts, no promotional or unverifiable claims, and length limits. Approval refuses drafts based on an older version of the product, updates the demo catalog only, and records each changed field in the change history. The storefront uses the SEO description as the page's meta description.

Without configuration the console uses a **public demo login**, shown on the login page:

| Email                          | Password         |
| ------------------------------ | ---------------- |
| `merchant@meroandmoss.example` | `moss-demo-2026` |

To use your own credentials, set `MERCHANT_EMAIL` and `MERCHANT_PASSWORD_HASH` (generate the hash with `npm run merchant:hash -- "<password>"`). The demo login is then disabled.

## Scripts

| Command                       | Purpose                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`                 | Start the development server                                                   |
| `npm run build` / `npm start` | Production build / serve                                                       |
| `npm run lint`                | ESLint                                                                         |
| `npm run typecheck`           | TypeScript type check                                                          |
| `npm test`                    | Unit and integration tests (Vitest)                                            |
| `npm run test:e2e`            | End-to-end tests (Playwright, after `npm run build`)                           |
| `npm run check`               | Everything CI runs: lint, typecheck, test, build                               |
| `npm run db:reset`            | Recreate the local demo database from seed data                                |
| `npm run worker`              | Poll the outbox and run due automation jobs (`-- --once` to run once)          |
| `npm run perf`                | Lighthouse against a production build (see [TEST_RESULTS.md](TEST_RESULTS.md)) |

## Architecture

A single Next.js 16 App Router application in strict TypeScript, with pure domain modules (`src/domain`), persistence and integration adapters behind interfaces (`src/server`), and storefront and merchant routes (`src/app`). Details are in [CLAUDE.md](CLAUDE.md).

## Project documents

- [DEMO_TOUR.md](DEMO_TOUR.md): a guided path through the product, about five minutes
- [FEATURE_TO_CLIENT_REQUEST.md](FEATURE_TO_CLIENT_REQUEST.md): what you can try for each kind of project
- [SERVICE_ADAPTATIONS.md](SERVICE_ADAPTATIONS.md): what exists and what would be built for each project
- [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md): the real state of every connection
- [DEPLOYMENT.md](DEPLOYMENT.md): running it outside a development machine, and its limits
- [docs/samples/webhooks/](docs/samples/webhooks/README.md): synthetic webhook samples and how to sign them
- [TEST_RESULTS.md](TEST_RESULTS.md): what has been run, and the coverage gaps
- [PROJECT_BRIEF.md](PROJECT_BRIEF.md): product promise, target buyers, non-goals
- [TASKS.md](TASKS.md): milestones and status
- [docs/DEVLOG.md](docs/DEVLOG.md): development log
- `.claude/skills/mero-moss-commerce/`: original product requirements and market references

_Mero & Moss is a fictional brand. Trademark and domain availability have not been verified._
