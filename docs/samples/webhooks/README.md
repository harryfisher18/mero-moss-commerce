# Sample webhook events

Synthetic payloads in the general shape of Shopify's `orders/create` and `products/update` webhooks. They were written by hand for testing, were **not captured from a real store**, and contain only a subset of the real fields. Check Shopify's current documentation before relying on any field.

| File                   | Topic header                       |
| ---------------------- | ---------------------------------- |
| `orders-create.json`   | `X-Shopify-Topic: orders/create`   |
| `products-update.json` | `X-Shopify-Topic: products/update` |

This store has **no endpoint that receives webhooks yet**. The samples exercise the signature check only, `verifyShopifyWebhook` in `src/domain/integrations/shopify.ts`, and `tests/unit/sample-webhooks.test.ts` runs it against them.

## Signing a sample

Shopify sends a base64 HMAC-SHA256 of the raw request body in the `X-Shopify-Hmac-Sha256` header. To produce the same value with the test secret used here:

```bash
openssl dgst -sha256 -hmac "sample-webhook-secret" -binary docs/samples/webhooks/orders-create.json | base64
```

The signature covers exact bytes, so reformatting a file changes it. `sample-webhook-secret` is a public test value and must never be used on a real store.
