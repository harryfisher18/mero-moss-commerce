/**
 * Versioned schema migrations. Append new entries; never edit an applied one.
 * Money columns hold integer minor units; timestamps are UTC ISO-8601 strings.
 */
export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "catalog",
    sql: `
      CREATE TABLE categories (
        id          TEXT PRIMARY KEY,
        handle      TEXT NOT NULL UNIQUE,
        title       TEXT NOT NULL,
        description TEXT NOT NULL,
        position    INTEGER NOT NULL
      );

      CREATE TABLE products (
        id          TEXT PRIMARY KEY,
        handle      TEXT NOT NULL UNIQUE,
        title       TEXT NOT NULL,
        category_id TEXT NOT NULL REFERENCES categories(id),
        summary     TEXT NOT NULL,
        description TEXT NOT NULL,
        materials   TEXT NOT NULL,
        care        TEXT NOT NULL,
        tags        TEXT NOT NULL DEFAULT '[]',
        status      TEXT NOT NULL CHECK (status IN ('active', 'draft', 'archived')),
        featured    INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
        swatch      TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
      CREATE INDEX products_category_idx ON products(category_id, status);

      CREATE TABLE variants (
        id                 TEXT PRIMARY KEY,
        product_id         TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        sku                TEXT NOT NULL UNIQUE,
        title              TEXT NOT NULL,
        options            TEXT NOT NULL,
        price_minor        INTEGER NOT NULL CHECK (price_minor >= 0),
        compare_at_minor   INTEGER CHECK (compare_at_minor IS NULL OR compare_at_minor >= 0),
        currency           TEXT NOT NULL,
        inventory_quantity INTEGER NOT NULL CHECK (inventory_quantity >= 0),
        position           INTEGER NOT NULL
      );
      CREATE INDEX variants_product_idx ON variants(product_id, position);

      CREATE TABLE store_policies (
        key        TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        summary    TEXT NOT NULL,
        body       TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: "carts",
    sql: `
      CREATE TABLE carts (
        id         TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE cart_lines (
        cart_id    TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        variant_id TEXT NOT NULL,
        quantity   INTEGER NOT NULL CHECK (quantity > 0),
        position   INTEGER NOT NULL,
        PRIMARY KEY (cart_id, variant_id)
      );
    `,
  },
  {
    version: 3,
    name: "orders",
    sql: `
      -- DEMO store: every order is simulated. No payment data is ever stored.
      CREATE TABLE orders (
        id                 TEXT PRIMARY KEY,
        sequence           INTEGER NOT NULL UNIQUE CHECK (sequence > 0),
        order_number       TEXT NOT NULL UNIQUE,
        status             TEXT NOT NULL DEFAULT 'placed'
                             CHECK (status IN ('placed', 'processing', 'fulfilled', 'cancelled')),
        is_simulated       INTEGER NOT NULL DEFAULT 1 CHECK (is_simulated = 1),
        email              TEXT NOT NULL,
        full_name          TEXT NOT NULL,
        address1           TEXT NOT NULL,
        address2           TEXT NOT NULL DEFAULT '',
        city               TEXT NOT NULL,
        region             TEXT NOT NULL,
        postal_code        TEXT NOT NULL,
        country            TEXT NOT NULL,
        currency           TEXT NOT NULL,
        subtotal_minor     INTEGER NOT NULL CHECK (subtotal_minor >= 0),
        shipping_minor     INTEGER NOT NULL CHECK (shipping_minor >= 0),
        total_minor        INTEGER NOT NULL CHECK (total_minor >= 0),
        confirmation_token TEXT NOT NULL UNIQUE,
        created_at         TEXT NOT NULL
      );
      CREATE INDEX orders_created_idx ON orders(created_at);

      CREATE TABLE order_lines (
        order_id         TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        position         INTEGER NOT NULL,
        variant_id       TEXT NOT NULL,
        product_id       TEXT NOT NULL,
        sku              TEXT NOT NULL,
        product_title    TEXT NOT NULL,
        variant_title    TEXT,
        unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
        quantity         INTEGER NOT NULL CHECK (quantity > 0),
        line_total_minor INTEGER NOT NULL CHECK (line_total_minor >= 0),
        PRIMARY KEY (order_id, position)
      );
    `,
  },
  {
    version: 4,
    name: "merchant_console",
    sql: `
      -- Only a SHA-256 digest of each session token is stored; the raw token lives in the cookie.
      CREATE TABLE merchant_sessions (
        token_hash TEXT PRIMARY KEY,
        email      TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX merchant_sessions_expiry_idx ON merchant_sessions(expires_at);

      CREATE TABLE login_attempts (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        email        TEXT NOT NULL,
        succeeded    INTEGER NOT NULL CHECK (succeeded IN (0, 1)),
        attempted_at TEXT NOT NULL
      );
      CREATE INDEX login_attempts_email_idx ON login_attempts(email, attempted_at);

      CREATE TABLE order_status_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        from_status TEXT,
        to_status   TEXT NOT NULL,
        actor       TEXT NOT NULL,
        note        TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL
      );
      CREATE INDEX order_status_events_order_idx ON order_status_events(order_id, id);
    `,
  },
  {
    version: 5,
    name: "catalog_audit",
    sql: `
      -- One row per changed field. Values are stored as display strings (prices as decimals).
      CREATE TABLE catalog_audit_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'variant')),
        entity_id   TEXT NOT NULL,
        label       TEXT NOT NULL,
        field       TEXT NOT NULL,
        before      TEXT NOT NULL,
        after       TEXT NOT NULL,
        actor       TEXT NOT NULL,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX catalog_audit_product_idx ON catalog_audit_events(product_id, id);
    `,
  },
  {
    version: 6,
    name: "order_automation",
    sql: `
      -- Transactional outbox. The event id doubles as the idempotency key for every effect.
      CREATE TABLE outbox_events (
        id              TEXT PRIMARY KEY,
        type            TEXT NOT NULL CHECK (type IN ('order.created', 'automation.drill')),
        aggregate_id    TEXT NOT NULL,
        subject         TEXT NOT NULL,
        payload         TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'succeeded', 'dead')),
        attempts        INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        max_attempts    INTEGER NOT NULL CHECK (max_attempts > 0),
        next_attempt_at TEXT NOT NULL,
        last_error      TEXT,
        created_at      TEXT NOT NULL,
        processed_at    TEXT
      );
      CREATE INDEX outbox_due_idx ON outbox_events(status, next_attempt_at);
      CREATE INDEX outbox_aggregate_idx ON outbox_events(aggregate_id);
      CREATE INDEX outbox_created_idx ON outbox_events(created_at);

      CREATE TABLE job_attempts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id    TEXT NOT NULL REFERENCES outbox_events(id) ON DELETE CASCADE,
        trigger     TEXT NOT NULL CHECK (trigger IN ('worker', 'retry_now', 'replay')),
        outcome     TEXT NOT NULL CHECK (outcome IN ('succeeded', 'duplicate', 'failed', 'dead')),
        detail      TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL
      );
      CREATE INDEX job_attempts_event_idx ON job_attempts(event_id, id);

      -- Effects. Unique keys make reprocessing the same event a no-op.
      CREATE TABLE order_tags (
        order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        tag             TEXT NOT NULL,
        source_event_id TEXT NOT NULL REFERENCES outbox_events(id) ON DELETE CASCADE,
        created_at      TEXT NOT NULL,
        PRIMARY KEY (order_id, tag)
      );

      -- Recorded previews only. Nothing in this project delivers messages.
      CREATE TABLE notification_previews (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id   TEXT NOT NULL REFERENCES outbox_events(id) ON DELETE CASCADE,
        kind       TEXT NOT NULL CHECK (kind IN ('customer_confirmation', 'merchant_review')),
        recipient  TEXT NOT NULL,
        subject    TEXT NOT NULL,
        body       TEXT NOT NULL,
        delivery   TEXT NOT NULL DEFAULT 'preview_only' CHECK (delivery = 'preview_only'),
        created_at TEXT NOT NULL,
        UNIQUE (event_id, kind)
      );
    `,
  },
  {
    version: 7,
    name: "support_requests",
    sql: `
      -- "Talk to a person" requests from the shopping advisor. Nothing is emailed in DEMO mode.
      CREATE TABLE support_requests (
        id         TEXT PRIMARY KEY,
        email      TEXT NOT NULL,
        message    TEXT NOT NULL,
        question   TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX support_requests_created_idx ON support_requests(created_at);
    `,
  },
];
