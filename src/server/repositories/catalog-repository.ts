import { z } from "zod";
import {
  CATEGORY_HANDLES,
  type Category,
  type CategoryHandle,
  type Product,
  type ProductStatus,
  type Variant,
} from "@/domain/commerce/catalog";
import { money, SUPPORTED_CURRENCIES } from "@/domain/commerce/money";
import { POLICY_KEYS, type StorePolicy } from "@/domain/commerce/policies";
import type { Database } from "@/server/db/database";

export interface ProductQuery {
  readonly categoryHandle?: CategoryHandle;
  readonly featured?: boolean;
  /** Defaults to `["active"]`; storefront callers must never see drafts. */
  readonly statuses?: readonly ProductStatus[];
  readonly limit?: number;
}

/** Read side of the catalog. Implementations: SQLite (demo); future platform adapters. */
export interface CatalogRepository {
  listCategories(): Category[];
  listProducts(query?: ProductQuery): Product[];
  getProductByHandle(handle: string, statuses?: readonly ProductStatus[]): Product | null;
  countActiveProductsByCategory(): Record<CategoryHandle, number>;
  listPolicies(): StorePolicy[];
}

const categoryRow = z.object({
  id: z.string(),
  handle: z.enum(CATEGORY_HANDLES),
  title: z.string(),
  description: z.string(),
  position: z.number().int(),
});

const productRow = z.object({
  id: z.string(),
  handle: z.string(),
  title: z.string(),
  category_handle: z.enum(CATEGORY_HANDLES),
  summary: z.string(),
  description: z.string(),
  materials: z.string(),
  care: z.string(),
  tags: z.string(),
  status: z.enum(["active", "draft", "archived"]),
  featured: z.number().int(),
  swatch: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const variantRow = z.object({
  id: z.string(),
  product_id: z.string(),
  sku: z.string(),
  title: z.string(),
  options: z.string(),
  price_minor: z.number().int(),
  compare_at_minor: z.number().int().nullable(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  inventory_quantity: z.number().int(),
  position: z.number().int(),
});

const policyRow = z.object({
  key: z.enum(POLICY_KEYS),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  updated_at: z.string(),
});

const stringArray = z.array(z.string());
const optionRecord = z.record(z.string(), z.string());

function toVariant(row: z.infer<typeof variantRow>): Variant {
  return {
    id: row.id,
    productId: row.product_id,
    sku: row.sku,
    title: row.title,
    options: optionRecord.parse(JSON.parse(row.options)),
    price: money(row.price_minor, row.currency),
    compareAtPrice:
      row.compare_at_minor === null ? null : money(row.compare_at_minor, row.currency),
    inventoryQuantity: row.inventory_quantity,
    position: row.position,
  };
}

export class SqliteCatalogRepository implements CatalogRepository {
  constructor(private readonly db: Database) {}

  listCategories(): Category[] {
    return this.db
      .prepare("SELECT id, handle, title, description, position FROM categories ORDER BY position")
      .all()
      .map((row) => categoryRow.parse(row));
  }

  listProducts(query: ProductQuery = {}): Product[] {
    const statuses = query.statuses ?? ["active"];
    if (statuses.length === 0) return [];
    const where: string[] = [`p.status IN (${statuses.map(() => "?").join(", ")})`];
    const params: Array<string | number> = [...statuses];
    if (query.categoryHandle) {
      where.push("c.handle = ?");
      params.push(query.categoryHandle);
    }
    if (query.featured !== undefined) {
      where.push("p.featured = ?");
      params.push(query.featured ? 1 : 0);
    }
    let sql = `
      SELECT p.*, c.handle AS category_handle
      FROM products p JOIN categories c ON c.id = p.category_id
      WHERE ${where.join(" AND ")}
      ORDER BY c.position, p.title
    `;
    if (query.limit !== undefined) {
      sql += " LIMIT ?";
      params.push(Math.max(0, Math.trunc(query.limit)));
    }
    const rows = this.db
      .prepare(sql)
      .all(...params)
      .map((row) => productRow.parse(row));
    return this.attachVariants(rows);
  }

  getProductByHandle(
    handle: string,
    statuses: readonly ProductStatus[] = ["active"],
  ): Product | null {
    if (statuses.length === 0) return null;
    const row = this.db
      .prepare(
        `SELECT p.*, c.handle AS category_handle
         FROM products p JOIN categories c ON c.id = p.category_id
         WHERE p.handle = ? AND p.status IN (${statuses.map(() => "?").join(", ")})`,
      )
      .get(handle, ...statuses);
    if (!row) return null;
    return this.attachVariants([productRow.parse(row)])[0] ?? null;
  }

  countActiveProductsByCategory(): Record<CategoryHandle, number> {
    const counts = Object.fromEntries(CATEGORY_HANDLES.map((h) => [h, 0])) as Record<
      CategoryHandle,
      number
    >;
    const rows = this.db
      .prepare(
        `SELECT c.handle AS handle, COUNT(p.id) AS count
         FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.status = 'active'
         GROUP BY c.handle`,
      )
      .all();
    for (const row of rows) {
      const parsed = z.object({ handle: z.enum(CATEGORY_HANDLES), count: z.number() }).parse(row);
      counts[parsed.handle] = parsed.count;
    }
    return counts;
  }

  listPolicies(): StorePolicy[] {
    return this.db
      .prepare("SELECT key, title, summary, body, updated_at FROM store_policies ORDER BY rowid")
      .all()
      .map((row) => {
        const parsed = policyRow.parse(row);
        return {
          key: parsed.key,
          title: parsed.title,
          summary: parsed.summary,
          body: parsed.body,
          updatedAt: parsed.updated_at,
        };
      });
  }

  private attachVariants(rows: Array<z.infer<typeof productRow>>): Product[] {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const variants = this.db
      .prepare(
        `SELECT * FROM variants WHERE product_id IN (${ids.map(() => "?").join(", ")})
         ORDER BY product_id, position`,
      )
      .all(...ids)
      .map((row) => toVariant(variantRow.parse(row)));
    const byProduct = new Map<string, Variant[]>();
    for (const variant of variants) {
      const list = byProduct.get(variant.productId) ?? [];
      list.push(variant);
      byProduct.set(variant.productId, list);
    }
    return rows.map((row) => ({
      id: row.id,
      handle: row.handle,
      title: row.title,
      categoryHandle: row.category_handle,
      summary: row.summary,
      description: row.description,
      materials: row.materials,
      care: row.care,
      tags: stringArray.parse(JSON.parse(row.tags)),
      status: row.status,
      featured: row.featured === 1,
      swatch: row.swatch,
      variants: byProduct.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}
