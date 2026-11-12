# Deployment notes

How to run Mero & Moss outside a development machine. **It has not been deployed to production**, so treat this as a starting point and test it in your own environment. Every setting below is read by the code today.

## Before exposing it to anyone

Set `MERCHANT_EMAIL` and `MERCHANT_PASSWORD_HASH`. Without both, the merchant console uses the public demo login, and the login page displays it to anyone who visits.

```bash
npm run merchant:hash -- "a-long-unique-password"
```

## What it needs

- Node.js 24 or later, because it uses the built-in `node:sqlite`.
- One long-running server with a persistent local disk. It will not work on platforms with a temporary filesystem, such as typical serverless hosting.
- HTTPS. In production mode, session and cart cookies are marked `Secure`, so browsers reject them over plain HTTP, except on `localhost`.

## Run it

```bash
npm ci
npm run build
MERO_MOSS_DB_PATH=/var/lib/mero-moss/shop.db npm start
```

`npm ci` installs development dependencies too, which the build and the worker need, so do not add `--omit=dev`.

An empty database is created, migrated and seeded with the demo catalog on first use. Migrations run automatically when the app opens the database, and new ones apply on the next start.

Run the worker as a second long-running process, using the same `MERO_MOSS_DB_PATH`:

```bash
MERO_MOSS_DB_PATH=/var/lib/mero-moss/shop.db npm run worker
```

Without it, scheduled retries and abandoned-cart checks only run when a merchant triggers them in the console, or, for retries, when the next order is placed.

## Settings

All are optional for a demo. See `.env.example`.

| Variable                                                                    | Purpose                                                                       |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `MERO_MOSS_DB_PATH`                                                         | SQLite file. Default `.data/mero-moss.db`, relative to the working directory. |
| `MERCHANT_EMAIL`, `MERCHANT_PASSWORD_HASH`                                  | The merchant login. Required before exposing the console.                     |
| `ANTHROPIC_API_KEY`                                                         | Turns on optional Claude wording and drafts. Calls are billed to this key.    |
| `ADVISOR_MODEL`, `CONTENT_MODEL`                                            | Override the Claude model for each feature.                                   |
| `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, `SHOPIFY_API_VERSION` | Optional read-only Shopify connection.                                        |
| `SHOPIFY_WEBHOOK_SECRET`                                                    | Secret for verifying webhook signatures.                                      |

Keep secrets in your host's secret store and never commit them.

## Reverse proxy

Next.js recommends running behind a reverse proxy such as nginx. Pass the original `Host` header through, because the analytics endpoint compares it with the browser's `Origin` and rejects a mismatch.

## Data

- Keep the database on a local disk, not a network share, because it uses SQLite's WAL mode.
- Back up with SQLite's online backup, for example `sqlite3 shop.db ".backup backup.db"`. Copying only the main file while the app runs can miss recent writes.
- `npm run db:reset` **deletes the configured database** and reseeds it. Never run it against data you need.
- The console's **Settings → Reset demo data** does the same from the browser, but only while the public demo login is active. Once `MERCHANT_EMAIL` and `MERCHANT_PASSWORD_HASH` are set, the form is not shown and the server refuses the reset.

## Limits

- **One server only.** SQLite, per-process rate limits and integration status do not extend across instances.
- **Checkout is simulated.** A real store needs a supported payment flow.
- **Nothing is sent.** Notifications and lifecycle messages are previews.
- **No retention policy.** Orders, consents, support requests and analytics events are kept until removed.
- **No monitoring or health endpoint.** Logs go to standard output.
- **The catalog is synthetic demo data.**

See [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md) and the coverage gaps in [TEST_RESULTS.md](TEST_RESULTS.md).
