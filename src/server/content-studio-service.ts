import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Product } from "@/domain/commerce/catalog";
import { checkContent, type Violation } from "@/domain/content/constraints";
import {
  CONTENT_FIELDS,
  type ContentField,
  type ContentFields,
  contentFieldsSchema,
  normalizeContent,
  productFacts,
} from "@/domain/content/draft";
import { type Database, withTransaction } from "@/server/db/database";
import type { ContentDraftProvider } from "@/server/integrations/content-draft-provider";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";

export const DRAFT_SOURCES = ["rules", "ai", "edited"] as const;
export type ContentDraftSource = (typeof DRAFT_SOURCES)[number];
export const DRAFT_STATUSES = ["pending", "approved", "rejected", "superseded"] as const;
export type ContentDraftStatus = (typeof DRAFT_STATUSES)[number];

export interface ContentDraft {
  readonly id: string;
  readonly productId: string;
  readonly version: number;
  readonly source: ContentDraftSource;
  readonly model: string | null;
  readonly sourceNote: string;
  readonly fields: ContentFields;
  readonly status: ContentDraftStatus;
  /** The product's updated_at when the draft was based on it. */
  readonly baseUpdatedAt: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
}

const draftRow = z.object({
  id: z.string(),
  product_id: z.string(),
  version: z.number().int(),
  source: z.enum(DRAFT_SOURCES),
  model: z.string().nullable(),
  source_note: z.string(),
  title: z.string(),
  summary: z.string(),
  seo_description: z.string(),
  status: z.enum(DRAFT_STATUSES),
  base_updated_at: z.string(),
  created_by: z.string(),
  created_at: z.string(),
  decided_by: z.string().nullable(),
  decided_at: z.string().nullable(),
});

function toDraft(raw: unknown): ContentDraft {
  const row = draftRow.parse(raw);
  return {
    id: row.id,
    productId: row.product_id,
    version: row.version,
    source: row.source,
    model: row.model,
    sourceNote: row.source_note,
    fields: { title: row.title, summary: row.summary, seoDescription: row.seo_description },
    status: row.status,
    baseUpdatedAt: row.base_updated_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
  };
}

export type GenerateResult =
  | { readonly ok: true; readonly draft: ContentDraft }
  | { readonly ok: false; readonly reason: "not_found" };

export type EditResult =
  | { readonly ok: true; readonly draft: ContentDraft }
  | { readonly ok: false; readonly reason: "not_found" | "not_pending" | "invalid" };

export type ApproveResult =
  | { readonly ok: true; readonly product: Product; readonly changedFields: ContentField[] }
  | { readonly ok: false; readonly reason: "not_found" | "not_pending" | "stale" }
  | { readonly ok: false; readonly reason: "violations"; readonly violations: Violation[] };

export type RejectResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: "not_found" | "not_pending" };

const DRAFT_COLUMNS = `id, product_id, version, source, model, source_note, title, summary, seo_description,
  status, base_updated_at, created_by, created_at, decided_by, decided_at`;

/**
 * Content Studio: versioned copy proposals for a product. Drafts never change the catalog
 * by themselves. Approval is a separate, audited step that re-checks the factual
 * constraints against the product as it is now and refuses drafts based on an older
 * version of the product. Everything writes to the local demo catalog only.
 */
export class ContentStudioService {
  private readonly catalog: SqliteCatalogRepository;

  constructor(
    private readonly db: Database,
    private readonly provider: ContentDraftProvider,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = randomUUID,
  ) {
    this.catalog = new SqliteCatalogRepository(db);
  }

  product(productId: string): Product | null {
    return this.catalog.getProductById(productId);
  }

  /** All versions, newest first. */
  drafts(productId: string): ContentDraft[] {
    return this.db
      .prepare(
        `SELECT ${DRAFT_COLUMNS} FROM content_drafts WHERE product_id = ? ORDER BY version DESC`,
      )
      .all(productId)
      .map(toDraft);
  }

  draft(draftId: string): ContentDraft | null {
    const raw = this.db
      .prepare(`SELECT ${DRAFT_COLUMNS} FROM content_drafts WHERE id = ?`)
      .get(draftId);
    return raw ? toDraft(raw) : null;
  }

  async generate(productId: string, actor: string): Promise<GenerateResult> {
    const product = this.catalog.getProductById(productId);
    if (!product) return { ok: false, reason: "not_found" };
    // The provider may call a model, so it runs outside the write transaction.
    const result = await this.provider.draft(productFacts(product));
    const draft = withTransaction(this.db, () =>
      this.insertVersion(productId, {
        source: result.source,
        model: result.model,
        sourceNote: result.note,
        fields: result.fields,
        baseUpdatedAt: product.updatedAt,
        actor,
      }),
    );
    return { ok: true, draft };
  }

  /** Saves the merchant's changes as a new version; the earlier version is kept. */
  edit(draftId: string, raw: unknown, actor: string): EditResult {
    const parsed = contentFieldsSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, reason: "invalid" };
    return withTransaction(this.db, (): EditResult => {
      const current = this.draft(draftId);
      if (!current) return { ok: false, reason: "not_found" };
      if (current.status !== "pending") return { ok: false, reason: "not_pending" };
      const draft = this.insertVersion(current.productId, {
        source: "edited",
        model: null,
        sourceNote: `Edited by ${actor} from version ${String(current.version)}.`,
        fields: normalizeContent(parsed.data),
        baseUpdatedAt: current.baseUpdatedAt,
        actor,
      });
      return { ok: true, draft };
    });
  }

  approve(draftId: string, actor: string): ApproveResult {
    return withTransaction(this.db, (): ApproveResult => {
      const draft = this.draft(draftId);
      if (!draft) return { ok: false, reason: "not_found" };
      if (draft.status !== "pending") return { ok: false, reason: "not_pending" };
      const product = this.catalog.getProductById(draft.productId);
      if (!product) return { ok: false, reason: "not_found" };
      if (product.updatedAt !== draft.baseUpdatedAt) return { ok: false, reason: "stale" };
      const violations = checkContent(draft.fields, productFacts(product));
      if (violations.length > 0) return { ok: false, reason: "violations", violations };

      const at = this.now();
      const before: ContentFields = {
        title: product.title,
        summary: product.summary,
        seoDescription: product.seoDescription,
      };
      const changedFields = CONTENT_FIELDS.filter((field) => before[field] !== draft.fields[field]);
      if (changedFields.length > 0) {
        this.db
          .prepare(
            "UPDATE products SET title = ?, summary = ?, seo_description = ?, updated_at = ? WHERE id = ?",
          )
          .run(
            draft.fields.title,
            draft.fields.summary,
            draft.fields.seoDescription,
            at,
            product.id,
          );
        const audit = this.db.prepare(
          `INSERT INTO catalog_audit_events
             (product_id, entity_type, entity_id, label, field, before, after, actor, created_at)
           VALUES (?, 'product', ?, ?, ?, ?, ?, ?, ?)`,
        );
        for (const field of changedFields) {
          audit.run(
            product.id,
            product.id,
            product.handle,
            field,
            before[field],
            draft.fields[field],
            `${actor} (Content Studio, draft v${String(draft.version)})`,
            at,
          );
        }
      }
      this.db
        .prepare(
          "UPDATE content_drafts SET status = 'approved', decided_by = ?, decided_at = ? WHERE id = ?",
        )
        .run(actor, at, draft.id);
      const updated = this.catalog.getProductById(product.id);
      if (!updated) throw new Error("Product disappeared during approval");
      return { ok: true, product: updated, changedFields };
    });
  }

  reject(draftId: string, actor: string): RejectResult {
    return withTransaction(this.db, (): RejectResult => {
      const draft = this.draft(draftId);
      if (!draft) return { ok: false, reason: "not_found" };
      if (draft.status !== "pending") return { ok: false, reason: "not_pending" };
      this.db
        .prepare(
          "UPDATE content_drafts SET status = 'rejected', decided_by = ?, decided_at = ? WHERE id = ?",
        )
        .run(actor, this.now(), draft.id);
      return { ok: true };
    });
  }

  private insertVersion(
    productId: string,
    input: {
      source: ContentDraftSource;
      model: string | null;
      sourceNote: string;
      fields: ContentFields;
      baseUpdatedAt: string;
      actor: string;
    },
  ): ContentDraft {
    const at = this.now();
    const next =
      Number(
        this.db
          .prepare("SELECT COALESCE(MAX(version), 0) AS v FROM content_drafts WHERE product_id = ?")
          .get(productId)?.v,
      ) + 1;
    // Only one pending draft per product: older pending versions are superseded.
    this.db
      .prepare(
        "UPDATE content_drafts SET status = 'superseded', decided_at = ? WHERE product_id = ? AND status = 'pending'",
      )
      .run(at, productId);
    const id = this.newId();
    this.db
      .prepare(
        `INSERT INTO content_drafts
           (id, product_id, version, source, model, source_note, title, summary, seo_description,
            base_updated_at, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        productId,
        next,
        input.source,
        input.model,
        input.sourceNote,
        input.fields.title,
        input.fields.summary,
        input.fields.seoDescription,
        input.baseUpdatedAt,
        input.actor,
        at,
      );
    const draft = this.draft(id);
    if (!draft) throw new Error("Draft was not saved");
    return draft;
  }
}
