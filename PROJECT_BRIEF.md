# Mero & Moss — Project Brief

## Product promise

Mero & Moss is a fictional direct-to-consumer retailer of well-made home and everyday essentials: home organization, table and kitchen, workspace accessories, and travel-ready essentials. Its positioning is _"Well-made essentials for everyday living."_

The codebase is a working commerce product with three connected surfaces that share one catalog and one order model:

1. **Customer storefront**: browse, filter, choose variants, use the cart, and complete a clearly labeled simulated checkout.
2. **Merchant console** (`/admin`): products, orders, automations, AI content approvals, analytics, and integration status.
3. **AI and automation layer**: a catalog-grounded shopping advisor, human-approved content drafts, and durable order event processing.

## Target buyer

Prospective freelance clients, principally US and international merchants, who are planning:

- a new online store, or the modernization of an existing one
- a Shopify redesign or conversion-rate work
- Shopify API, app or integration engineering
- applied AI for product discovery or catalog content
- order or lifecycle automation and analytics

They should be able to use the product and recognize their own project in it. The evidence and its limits are in `.claude/skills/mero-moss-commerce/references/`.

## Assumptions

- Local DEMO mode is the default and needs no external keys or services.
- Persistence is SQLite through Node's built-in `node:sqlite`, behind repository interfaces, so it can be swapped for PostgreSQL.
- Shopify connectivity is an adapter seam until it is verified against an authorized development store.
- An LLM is optional. Every AI feature has a deterministic, grounded fallback.

## Non-goals

- Real payment processing, card forms, or live charges.
- Claims of connected integrations, client results, revenue lifts, or reviews that have not been verified.
- WooCommerce, ERP, B2B, or subscription support beyond documented adapter seams (P2).
- Production deployment without separate authorization.

## Boundaries and honesty

The brand name has not been cleared for trademark or domain use. All seeded products, customers and orders are synthetic demo data and are labeled as such where relevant.
