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
];
