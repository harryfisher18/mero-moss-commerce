# Real Buyer Need → Demonstration → Freelance Deliverable

This matrix is a **sales-readiness / functional coverage checklist**, not a list of invented clients.

| Prospective client says… | What they should be able to try | What freelance work it can credibly demonstrate |
|---|---|---|
| "Build a polished store from scratch" | Navigate storefront, filters, product variants, cart, simulated checkout, order status | Full-stack shop UX, product data modeling, responsive frontend, validation, orders |
| "Redesign our old Shopify store" | Interactive before/after product page, mobile nav, accessibility improvements | Liquid/theme components, UX/CRO, regression and performance QA (Shopify integration must be validated) |
| "Customers cannot find the right products" | Ask advisor for a budget-limited product comparison, click real linked variants | Grounded AI/RAG, product discovery, human escalation, retrieval safeguards |
| "We spend hours handling orders" | Create simulated order, watch durable workflow job and routing; replay safely | Webhooks, job queues, n8n/fulfillment adapter patterns, operator tooling |
| "We want automated product SEO" | Generate, review, approve and apply a product description draft | AI copy workflow, merchant approvals, catalog APIs, audit trail |
| "We need email flows after purchase" | View consent-safe automated journey preview; optional verified Klaviyo adapter | Lifecycle workflows, integration mapping, event deduplication (not live-send by default) |
| "Need conversion tracking" | Inspect recorded app-level add-to-cart/checkout events and data QA view | Event modeling; verified GA4/Meta setup only if implemented |
| "We have a WooCommerce or custom shop" | Read portable commerce-domain architecture and adapter interface; no fake native support | Future scoping/customization capability, not proof of completed WooCommerce connector |

**Do not replace a functioning product with this matrix.** It is an internal build compass and an optional small buyer-facing `Capabilities` walkthrough tied to true routes/actions.
