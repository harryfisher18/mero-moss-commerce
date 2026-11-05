# Mero & Moss — Claude Code Setup and Usage

## Purpose

This Claude Code skill is designed to build a **working e-commerce product**, not a portfolio website or a developer dashboard. Prospective clients who need a new online store, an existing Shopify store upgrade, AI integration, or API and workflow automation should be able to explore Mero & Moss and recognize capabilities applicable to their own business requirements.

**Mero & Moss** is the official project and retail brand name. The product is a coherent home and everyday-essentials store, with a customer-facing storefront, merchant administration, AI-powered discovery and content assistance, and order automation—all backed by consistent product and order data.

## Install in Claude Code

Extract the archive. Place the `mero-moss-commerce` folder in your project's `.claude/skills/` directory so that the resulting structure is:

```text
<your-project>/
  .claude/
    skills/
      mero-moss-commerce/
        SKILL.md
        README.md
        references/
          MARKET_BRIEF_2026-11-05.md
          CLIENT_BRIEF_TO_FEATURE_MATRIX.md
```

Open the project in Claude Code and run:

```text
/mero-moss-commerce build
```

To adapt an existing implementation to a client's specific requirements, run, for example:

```text
/mero-moss-commerce adapt Add a Shopify order-to-Slack approval workflow with retries and an event log
```

You can also run `audit`, `research`, or `extend` modes. See `SKILL.md` for their definitions and implementation requirements.

**Important:** This package contains Claude Code instructions and market research, not a finished e-commerce application. Claude Code must generate and verify the application source code in your project.

## Definition of Done

1. A customer-facing store with working search, filters, variants, cart, and simulated order checkout.
2. A merchant interface linked to the same products, inventory, and orders.
3. Catalog-grounded AI shopping guidance and human-approved product content drafts.
4. Durable order automation with event logging, retries, and deduplication.
5. Interactive, clearly labeled illustrative before-and-after store improvements.
6. Documented verification of the actual tests and integrations that have run.

The application must work in local **DEMO mode** without external API keys. The checkout must explicitly state that it does not accept payment and only creates simulated orders. Never trigger real charges, customer messages, Shopify production-store changes, or other live side effects without authorization and approval.

## Brand and Customer Experience

The public-facing experience must look and behave like an authentic **Mero & Moss** online retailer, not a software tool or developer showcase. Its home page should focus on merchandise and shopping. The merchant console, AI workflows, integration status, and upgrade comparisons are internal features of the same commerce product.

**Brand positioning:** *Well-made essentials for everyday living.*

This is a proposed fictional project name; trademark and domain availability have not been verified and must be checked before real-world commercial launch.
