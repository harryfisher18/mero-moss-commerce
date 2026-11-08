# Service adaptations

How this codebase could become six kinds of client project. Each section separates what exists here from what would still have to be built. Nothing under "To build" exists yet, and Shopify work would need an authorized store.

## New Shopify store

**Exists here**

- A catalog model with variants, stock states, pricing in integer minor units, and filtering.
- A mobile-first storefront, cart and checkout flow that pass automated accessibility checks.
- A read-only `ShopifyStoreAdapter` that has been tested only against a stand-in.

**To build**

- A Shopify theme or headless storefront, using Shopify's own checkout for payment.
- Catalog sync, tested on a development store.
- Your brand, photography and content.

## Store redesign and conversion work

**Exists here**

- The Upgrade Lab pattern: the same product in a before and an after, with illustrative labelling.
- Patterns for accessible variant selection, stock messaging and policy links.
- Repeatable axe and Lighthouse checks, and layout-stability fixes those checks led to.

**To build**

- An audit of your current theme.
- Changes in your theme, removable without affecting the store.
- Measurement on your real traffic. This repository contains no conversion results.

## Shopify embedded app

**Exists here**

- The `StorePlatformAdapter` boundary and a webhook signature check using a timing-safe comparison.
- An audited merchant console, with validated Server Actions.

**To build**

- An app built on Shopify's official scaffold, with its installation and authentication flow.
- Minimal access scopes, webhook endpoints, deduplication and reconciliation.
- Verification on a development store.

## AI shopping assistant

**Exists here**

- Parsing and retrieval that work with no API key, and answers that cite only catalog and policy data.
- Honest handling of sold-out items, discounts and missing policies, and a route to a person.
- Optional Claude wording with a validator that rejects new prices, codes, links and unsupported claims. It has been tested with simulated replies only.

**To build**

- Tuning for your catalog and vocabulary.
- A verified model connection, with cost limits suited to your traffic.
- Rate limiting shared across servers, and review of real conversations.

## Order automation

**Exists here**

- A transactional outbox, so an order and its event always commit together.
- A worker with routing, review tags, bounded retries, a dead letter queue and safe replay.
- A job inspector with personal data masked.

**To build**

- Your routing and review rules.
- Connections to your fulfilment partner, warehouse or n8n flows.
- A production queue and database, since this demo runs on SQLite on one server.

## Lifecycle marketing

**Exists here**

- Welcome, abandoned-cart and post-purchase journeys.
- A consent gate checked when each message is prepared, with withdrawal, and deduplication by event.
- A `MarketingProvider` boundary with a demo implementation that contacts nobody.

**To build**

- A live provider such as Klaviyo, connected with your authorization.
- Confirmed opt-in, unsubscribe links, and rate limits on public forms.
- Your message content and legal review for your markets.
