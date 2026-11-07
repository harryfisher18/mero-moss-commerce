# Mero & Moss

_Well-made essentials for everyday living._

Mero & Moss is a working e-commerce product for a direct-to-consumer home and everyday-essentials brand. It has a customer storefront, a merchant console, and an AI and automation layer, all sharing one catalog and order model. It runs fully in local **DEMO mode** without any external API keys.

> **Demo boundaries:** checkout in DEMO mode creates **simulated orders only**. No payment is taken and no card details are collected. All products, customers and orders are synthetic demo data. No live integrations are claimed unless they are listed as verified in `INTEGRATION_STATUS.md`.

## What merchants can evaluate

| If you need…                         | Try this in Mero & Moss                                           | Status                                                                        |
| ------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A new or modernized online store     | Storefront browsing, filters, variants, cart, simulated checkout  | Done (M1): browse → cart → simulated checkout → order in the merchant console |
| Order operations without manual work | Order events, routing, retries and replay in the merchant console | Planned (M2)                                                                  |
| Better product discovery             | Catalog-grounded shopping advisor                                 | Planned (M3)                                                                  |
| AI-assisted catalog content          | Draft → review → approve workflow                                 | Planned (M3)                                                                  |
| Store redesign / CRO                 | Upgrade Lab before/after comparisons                              | Planned (M2)                                                                  |

See [TASKS.md](TASKS.md) for the live roadmap and the status of each item.

## Getting started

Requirements: **Node.js 24+** (uses the built-in `node:sqlite`) and npm 11+.

```bash
npm install
npm run dev            # http://localhost:3000 (the demo DB is created and seeded on first request)
npm run db:reset       # recreate the local demo database from seed data
```

Copy `.env.example` to `.env.local` to override defaults. No variables are required for DEMO mode.

## Merchant console

Open [/admin](http://localhost:3000/admin) to:

- **Orders:** list and filter simulated orders, view detail and history, and move them through placed → processing → fulfilled, or cancel (which restocks).
- **Products:** edit title, copy, status, price, compare-at price and stock per variant. Changes reach the storefront, cart and checkout on the next request, and every changed field is recorded in the product's change history.

Without configuration the console uses a **public demo login**, shown on the login page:

| Email                          | Password         |
| ------------------------------ | ---------------- |
| `merchant@meroandmoss.example` | `moss-demo-2026` |

To use your own credentials, set `MERCHANT_EMAIL` and `MERCHANT_PASSWORD_HASH` (generate the hash with `npm run merchant:hash -- "<password>"`). The demo login is then disabled.

## Scripts

| Command                       | Purpose                                              |
| ----------------------------- | ---------------------------------------------------- |
| `npm run dev`                 | Start the development server                         |
| `npm run build` / `npm start` | Production build / serve                             |
| `npm run lint`                | ESLint                                               |
| `npm run typecheck`           | TypeScript type check                                |
| `npm test`                    | Unit and integration tests (Vitest)                  |
| `npm run test:e2e`            | End-to-end tests (Playwright, after `npm run build`) |
| `npm run check`               | Everything CI runs: lint, typecheck, test, build     |
| `npm run db:reset`            | Recreate the local demo database from seed data      |

## Architecture

A single Next.js 16 App Router application in strict TypeScript, with pure domain modules (`src/domain`), persistence and integration adapters behind interfaces (`src/server`), and storefront and merchant routes (`src/app`). Details are in [CLAUDE.md](CLAUDE.md).

## Project documents

- [PROJECT_BRIEF.md](PROJECT_BRIEF.md): product promise, target buyers, non-goals
- [TASKS.md](TASKS.md): milestones and status
- [docs/DEVLOG.md](docs/DEVLOG.md): development log
- `.claude/skills/mero-moss-commerce/`: original product requirements and market references

_Mero & Moss is a fictional brand. Trademark and domain availability have not been verified._
