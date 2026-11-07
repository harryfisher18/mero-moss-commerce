import { z } from "zod";
import type { Product } from "@/domain/commerce/catalog";
import {
  type AuditChange,
  diffProductEdit,
  type EditErrors,
  parseProductEdit,
  type RawProductEdit,
} from "@/domain/commerce/product-edit";
import { type Database, withTransaction } from "@/server/db/database";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";

export interface CatalogAuditEvent extends AuditChange {
  readonly actor: string;
  readonly createdAt: string;
}

export type SaveProductResult =
  | { readonly ok: true; readonly product: Product; readonly changes: readonly AuditChange[] }
  | { readonly ok: false; readonly reason: "not_found" }
  | { readonly ok: false; readonly reason: "conflict" }
  | { readonly ok: false; readonly reason: "invalid"; readonly errors: EditErrors };

const auditRow = z.object({
  entity_type: z.enum(["product", "variant"]),
  entity_id: z.string(),
  label: z.string(),
  field: z.string(),
  before: z.string(),
  after: z.string(),
  actor: z.string(),
  created_at: z.string(),
});

/**
 * Merchant catalog edits. Callers must have verified a merchant session. A save validates
 * against the product as it is now, rejects stale forms (optimistic concurrency on
 * `updated_at`), writes product and variant changes, and records one audit row per
 * changed field, all in a single transaction. Storefront reads are request-time, so the
 * shop, cart and checkout see the new values on their next request.
 */
export class ProductEditService {
  private readonly catalog: SqliteCatalogRepository;

  constructor(
    private readonly db: Database,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    this.catalog = new SqliteCatalogRepository(db);
  }

  listAll(): Product[] {
    return this.catalog.listProducts({ statuses: ["active", "draft", "archived"] });
  }

  get(productId: string): Product | null {
    return this.catalog.getProductById(productId);
  }

  audit(productId: string, limit = 50): CatalogAuditEvent[] {
    return this.db
      .prepare(
        `SELECT entity_type, entity_id, label, field, before, after, actor, created_at
         FROM catalog_audit_events WHERE product_id = ? ORDER BY id DESC LIMIT ?`,
      )
      .all(productId, limit)
      .map((raw) => {
        const row = auditRow.parse(raw);
        return {
          entityType: row.entity_type,
          entityId: row.entity_id,
          label: row.label,
          field: row.field,
          before: row.before,
          after: row.after,
          actor: row.actor,
          createdAt: row.created_at,
        };
      });
  }

  save(
    productId: string,
    expectedUpdatedAt: string,
    raw: RawProductEdit,
    actor: string,
  ): SaveProductResult {
    return withTransaction(this.db, (): SaveProductResult => {
      const product = this.catalog.getProductById(productId);
      if (!product) return { ok: false, reason: "not_found" };
      if (product.updatedAt !== expectedUpdatedAt) return { ok: false, reason: "conflict" };

      const parsed = parseProductEdit(raw, product);
      if (!parsed.ok) return { ok: false, reason: "invalid", errors: parsed.errors };

      const changes = diffProductEdit(product, parsed.edit);
      if (changes.length === 0) return { ok: true, product, changes };

      const now = this.now();
      const { edit } = parsed;
      this.db
        .prepare(
          "UPDATE products SET title = ?, summary = ?, description = ?, status = ?, updated_at = ? WHERE id = ?",
        )
        .run(edit.title, edit.summary, edit.description, edit.status, now, productId);
      const updateVariant = this.db.prepare(
        "UPDATE variants SET price_minor = ?, compare_at_minor = ?, inventory_quantity = ? WHERE id = ? AND product_id = ?",
      );
      for (const variant of edit.variants) {
        updateVariant.run(
          variant.price.amountMinor,
          variant.compareAtPrice?.amountMinor ?? null,
          variant.inventoryQuantity,
          variant.id,
          productId,
        );
      }
      const insertAudit = this.db.prepare(
        `INSERT INTO catalog_audit_events
           (product_id, entity_type, entity_id, label, field, before, after, actor, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const change of changes) {
        insertAudit.run(
          productId,
          change.entityType,
          change.entityId,
          change.label,
          change.field,
          change.before,
          change.after,
          actor,
          now,
        );
      }

      const updated = this.catalog.getProductById(productId);
      if (!updated) throw new Error("Product disappeared during save");
      return { ok: true, product: updated, changes };
    });
  }
}
