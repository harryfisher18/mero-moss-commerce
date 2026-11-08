# Integration status

The state of every connection as of 2026-11-08. The live state is on `/admin/integrations`. **No external service has been connected or verified.**

| Integration                   | State today                                      | Sends data out?    | Can change a remote system? |
| ----------------------------- | ------------------------------------------------ | ------------------ | --------------------------- |
| Local demo catalog            | `DEMO`, working                                  | No                 | No                          |
| Shopify Admin API             | `DEMO`, built but never run against a real store | Only if configured | No: read-only               |
| Shopify webhooks              | Signature check only, with no endpoint           | No                 | No                          |
| Claude: advisor wording       | `DEMO`, built but never called for real          | Only if configured | No                          |
| Claude: Content Studio drafts | `DEMO`, built but never called for real          | Only if configured | No                          |
| Customer notifications        | Previews only                                    | No                 | No                          |
| Marketing email               | Previews only                                    | No                 | No                          |
| Payments                      | None: orders are simulated                       | No                 | No                          |

Klaviyo, Google Analytics, Meta, n8n, Slack and WooCommerce have no connector. First-party analytics stay inside this store's database.

## Shopify Admin API

- **Settings:** `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, `SHOPIFY_API_VERSION`.
- **Permissions needed:** an Admin API token that can read products (`read_products`).
- **What it does:** reads shop details and products through GraphQL when a merchant selects **Verify connection**. It has no write methods.
- **Tests:** configuration rules, the exact request sent, pagination, and eight failure modes, all against a stand-in. See `src/server/integrations/store-platform.test.ts`.
- **Missing:** an authorized development store and token.
- **Rollback:** remove the settings and restart. The page returns to `DEMO`, and nothing on Shopify will have changed.
- **Limits:** the storefront still runs on the local catalog. There is no sync. A verified state lasts until the server restarts.

## Shopify webhooks

- **Settings:** `SHOPIFY_WEBHOOK_SECRET`.
- **What exists:** `verifyShopifyWebhook` checks the base64 HMAC-SHA256 of the raw body with a timing-safe comparison.
- **Tests:** valid signatures, altered bodies, wrong secrets and malformed headers. See `src/domain/integrations/shopify.test.ts`.
- **Missing:** an endpoint to receive webhooks, deduplication and reconciliation.

## Claude (advisor wording and Content Studio drafts)

- **Settings:** `ANTHROPIC_API_KEY`, and optionally `ADVISOR_MODEL` and `CONTENT_MODEL`. The default model for both is `claude-opus-5-5`.
- **Permissions needed:** an Anthropic API key. Calls are billed to that key.
- **Data sent:** the shopper's question and catalog facts for the advisor, and product facts for drafts. Customer details are not sent.
- **Safeguards:** advisor replies are rejected if they add a price, percentage, code, link, contact detail or unsupported "free" claim. Drafts must pass the factual checks before approval. Any failure falls back to the no-key behaviour. Calls are limited per server process, to 20 a minute for the advisor and 10 for drafts.
- **Tests:** simulated replies only, including replies that obey injected instructions.
- **Missing:** a key, and a real call. None has been made.
- **Rollback:** remove the key and restart.
- **Limits:** the call limits are per server process. The checks work on known word lists, so a person must still review drafts.

## Customer notifications and marketing email

- **What exists:** order notifications and lifecycle messages are stored as previews. The database accepts only `preview_only` delivery.
- **Consent:** lifecycle messages need an explicit opt-in, which a merchant can withdraw.
- **Missing:** a provider, confirmed opt-in, unsubscribe links and rate limits on the public cart form. Live sending would need separate authorization and a schema change.
- **Rollback:** not applicable, because nothing is sent.

## Payments

Checkout creates simulated orders only. There is no card form or payment processor. A real store should use its platform's own supported checkout.
