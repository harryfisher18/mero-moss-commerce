import { type Database, withTransaction } from "./database";
import {
  SEED_CATEGORIES,
  SEED_CURRENCY,
  SEED_POLICIES,
  SEED_PRODUCTS,
  SEED_REFERENCE_DATE,
} from "./seed-data";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isSeeded(db: Database): boolean {
  const row = db.prepare("SELECT COUNT(*) AS count FROM categories").get();
  return Number(row?.count ?? 0) > 0;
}

export function variantTitle(options: Record<string, string>): string {
  const values = Object.values(options);
  return values.length > 0 ? values.join(" / ") : "Default";
}

/** Inserts the synthetic demo catalog. Expects an empty, migrated database. */
/**
 * Inserts the demo catalog in one transaction. With `onlyIfEmpty`, the emptiness check runs
 * while the write lock is held, so processes starting together cannot seed twice.
 */
export function seedDatabase(db: Database, options: { onlyIfEmpty?: boolean } = {}): void {
  const reference = Date.parse(SEED_REFERENCE_DATE);

  withTransaction(db, () => {
    if (options.onlyIfEmpty && isSeeded(db)) return;
    const insertCategory = db.prepare(
      "INSERT INTO categories (id, handle, title, description, position) VALUES (?, ?, ?, ?, ?)",
    );
    SEED_CATEGORIES.forEach((category, index) => {
      insertCategory.run(
        `cat_${category.handle}`,
        category.handle,
        category.title,
        category.description,
        index,
      );
    });

    const insertProduct = db.prepare(`
      INSERT INTO products (id, handle, title, category_id, summary, description, materials, care,
                            tags, status, featured, swatch, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `);
    const insertVariant = db.prepare(`
      INSERT INTO variants (id, product_id, sku, title, options, price_minor, compare_at_minor,
                            currency, inventory_quantity, position)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `);

    for (const product of SEED_PRODUCTS) {
      const productId = `prod_${product.handle}`;
      const createdAt = new Date(reference - product.addedDaysAgo * DAY_MS).toISOString();
      insertProduct.run(
        productId,
        product.handle,
        product.title,
        `cat_${product.category}`,
        product.summary,
        product.description,
        product.materials,
        product.care,
        JSON.stringify(product.tags),
        product.featured ? 1 : 0,
        product.swatch,
        createdAt,
        createdAt,
      );
      product.variants.forEach((variant, index) => {
        insertVariant.run(
          `var_${variant.sku.toLowerCase()}`,
          productId,
          variant.sku,
          variantTitle(variant.options),
          JSON.stringify(variant.options),
          variant.priceMinor,
          SEED_CURRENCY,
          variant.inventory,
          index,
        );
      });
    }

    const insertPolicy = db.prepare(
      "INSERT INTO store_policies (key, title, summary, body, updated_at) VALUES (?, ?, ?, ?, ?)",
    );
    for (const policy of SEED_POLICIES) {
      insertPolicy.run(policy.key, policy.title, policy.summary, policy.body, SEED_REFERENCE_DATE);
    }
  });
}
