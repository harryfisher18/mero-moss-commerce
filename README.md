# Mero & Moss

_Well-made essentials for everyday living._

Mero & Moss is a working e-commerce product for a direct-to-consumer home and everyday-essentials brand. It has a customer storefront, a merchant console, and an AI and automation layer, all sharing one catalog and order model. It runs fully in local **DEMO mode** without any external API keys.

> **Demo boundaries:** checkout in DEMO mode creates **simulated orders only**. No payment is taken and no card details are collected. All products, customers and orders are synthetic demo data. No live integrations are claimed unless they are listed as verified in `INTEGRATION_STATUS.md`.

## What merchants can evaluate

| If you need…                         | Try this in Mero & Moss                                           | Status           |
| ------------------------------------ | ----------------------------------------------------------------- | ---------------- |
| A new or modernized online store     | Storefront browsing, filters, variants, cart, simulated checkout  | In progress (M1) |
| Order operations without manual work | Order events, routing, retries and replay in the merchant console | Planned (M2)     |
| Better product discovery             | Catalog-grounded shopping advisor                                 | Planned (M3)     |
| AI-assisted catalog content          | Draft → review → approve workflow                                 | Planned (M3)     |
| Store redesign / CRO                 | Upgrade Lab before/after comparisons                              | Planned (M2)     |

See [TASKS.md](TASKS.md) for the live roadmap and the status of each item.

## Getting started

Requirements: **Node.js 24+** (uses the built-in `node:sqlite`) and npm 11+.

```bash
npm install
npm run dev            # http://localhost:3000
```

Copy `.env.example` to `.env.local` to override defaults. No variables are required for DEMO mode.

## Scripts

| Command                       | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `npm run dev`                 | Start the development server                     |
| `npm run build` / `npm start` | Production build / serve                         |
| `npm run lint`                | ESLint                                           |
| `npm run typecheck`           | TypeScript type check                            |
| `npm test`                    | Unit and integration tests (Vitest)              |
| `npm run test:e2e`            | End-to-end tests (Playwright)                    |
| `npm run check`               | Everything CI runs: lint, typecheck, test, build |

## Architecture

A single Next.js 16 App Router application in strict TypeScript, with pure domain modules (`src/domain`), persistence and integration adapters behind interfaces (`src/server`), and storefront and merchant routes (`src/app`). Details are in [CLAUDE.md](CLAUDE.md).

## Project documents

- [PROJECT_BRIEF.md](PROJECT_BRIEF.md): product promise, target buyers, non-goals
- [TASKS.md](TASKS.md): milestones and status
- [docs/DEVLOG.md](docs/DEVLOG.md): development log
- `.claude/skills/mero-moss-commerce/`: original product requirements and market references

_Mero & Moss is a fictional brand. Trademark and domain availability have not been verified._
