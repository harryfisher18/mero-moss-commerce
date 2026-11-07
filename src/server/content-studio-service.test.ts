import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ContentFields, ProductFacts } from "@/domain/content/draft";
import { ContentStudioService } from "@/server/content-studio-service";
import { type Database, openDatabase } from "@/server/db/database";
import { seedDatabase } from "@/server/db/seed";
import {
  type ContentDraftProvider,
  type DraftResult,
  FallbackContentDraftProvider,
  RULES_NOTE,
  RulesContentDraftProvider,
} from "@/server/integrations/content-draft-provider";
import { WordingStatus, WordingUnavailableError } from "@/server/integrations/wording-provider";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";
import { ProductEditService } from "@/server/product-edit-service";

const LAMP = "prod_brass-task-lamp";
const ACTOR = "merchant@meroandmoss.example";

let db: Database;
let clock: number;
let ids: number;
let studio: ContentStudioService;

const tick = () => new Date(Date.parse("2026-11-08T12:00:00.000Z") + clock++ * 1000).toISOString();
const newId = () => `draft-${String(++ids)}`;
const audit = () =>
  db
    .prepare(
      "SELECT field, before, after, actor FROM catalog_audit_events WHERE product_id = ? ORDER BY id",
    )
    .all(LAMP);

class FixedProvider implements ContentDraftProvider {
  constructor(private readonly fields: (facts: ProductFacts) => ContentFields) {}
  async draft(facts: ProductFacts): Promise<DraftResult> {
    return { fields: this.fields(facts), source: "ai", model: "test-model", note: "AI draft" };
  }
}

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
  clock = 0;
  ids = 0;
  studio = new ContentStudioService(db, new RulesContentDraftProvider(), tick, newId);
});

afterEach(() => db.close());

describe("ContentStudioService", () => {
  it("generates labelled rules-based drafts as numbered versions without touching the catalog", async () => {
    const before = studio.product(LAMP);
    const first = await studio.generate(LAMP, ACTOR);
    const second = await studio.generate(LAMP, ACTOR);
    if (!first.ok || !second.ok) throw new Error("generate failed");
    expect(first.draft).toMatchObject({
      version: 1,
      source: "rules",
      model: null,
      sourceNote: RULES_NOTE,
      status: "pending",
      createdBy: ACTOR,
    });
    expect(second.draft.version).toBe(2);
    // Only the newest draft stays pending.
    expect(studio.drafts(LAMP).map((d) => [d.version, d.status])).toEqual([
      [2, "pending"],
      [1, "superseded"],
    ]);
    expect(studio.product(LAMP)).toEqual(before);
    expect(await studio.generate("prod_missing", ACTOR)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("approves a clean draft into the catalog with one audit row per changed field", async () => {
    const generated = await studio.generate(LAMP, ACTOR);
    if (!generated.ok) throw new Error("generate failed");
    const result = studio.approve(generated.draft.id, ACTOR);
    expect(result).toMatchObject({ ok: true, changedFields: ["seoDescription"] });
    const product = studio.product(LAMP);
    expect(product?.seoDescription).toBe(generated.draft.fields.seoDescription);
    expect(audit()).toEqual([
      {
        field: "seoDescription",
        before: "",
        after: generated.draft.fields.seoDescription,
        actor: `${ACTOR} (Content Studio, draft v1)`,
      },
    ]);
    expect(studio.draft(generated.draft.id)).toMatchObject({
      status: "approved",
      decidedBy: ACTOR,
    });
    // A decided draft cannot be approved, rejected or edited again.
    expect(studio.approve(generated.draft.id, ACTOR)).toEqual({ ok: false, reason: "not_pending" });
    expect(studio.reject(generated.draft.id, ACTOR)).toEqual({ ok: false, reason: "not_pending" });
  });

  it("keeps every edit as a new version and blocks approval while checks fail", async () => {
    const generated = await studio.generate(LAMP, ACTOR);
    if (!generated.ok) throw new Error("generate failed");
    const flagged = studio.edit(
      generated.draft.id,
      {
        ...generated.draft.fields,
        summary: "The best brass desk lamp, now $99 with a 10-year warranty.",
      },
      ACTOR,
    );
    if (!flagged.ok) throw new Error("edit failed");
    expect(flagged.draft).toMatchObject({ version: 2, source: "edited", status: "pending" });

    const blocked = studio.approve(flagged.draft.id, ACTOR);
    expect(blocked.ok).toBe(false);
    if (blocked.ok || blocked.reason !== "violations") throw new Error("expected violations");
    expect(blocked.violations.map((v) => v.rule).sort()).toEqual([
      "claim",
      "claim",
      "number",
      "number",
      "price",
    ]);
    expect(audit()).toEqual([]);

    const fixed = studio.edit(
      flagged.draft.id,
      {
        title: "Brass Task Lamp",
        summary: "An adjustable brass desk lamp with a warm, focused beam.",
        seoDescription: generated.draft.fields.seoDescription,
      },
      ACTOR,
    );
    if (!fixed.ok) throw new Error("edit failed");
    expect(studio.approve(fixed.draft.id, ACTOR)).toMatchObject({
      ok: true,
      changedFields: ["summary", "seoDescription"],
    });
    expect(studio.product(LAMP)?.summary).toBe(
      "An adjustable brass desk lamp with a warm, focused beam.",
    );
    expect(studio.drafts(LAMP).map((d) => [d.version, d.source, d.status])).toEqual([
      [3, "edited", "approved"],
      [2, "edited", "superseded"],
      [1, "rules", "superseded"],
    ]);
  });

  it("refuses to approve a draft based on an older version of the product", async () => {
    const generated = await studio.generate(LAMP, ACTOR);
    if (!generated.ok) throw new Error("generate failed");
    // The merchant changes the product in the editor after the draft was generated.
    const editor = new ProductEditService(db, () => "2026-11-08T13:00:00.000Z");
    const product = studio.product(LAMP);
    if (!product) throw new Error("missing product");
    const saved = editor.save(
      LAMP,
      product.updatedAt,
      {
        title: product.title,
        summary: product.summary,
        description: product.description,
        status: product.status,
        variants: product.variants.map((v) => ({
          id: v.id,
          price: "150",
          compareAt: "",
          stock: String(v.inventoryQuantity),
        })),
      },
      ACTOR,
    );
    expect(saved.ok).toBe(true);
    expect(studio.approve(generated.draft.id, ACTOR)).toEqual({ ok: false, reason: "stale" });
  });

  it("rejects drafts and validates edits", async () => {
    const generated = await studio.generate(LAMP, ACTOR);
    if (!generated.ok) throw new Error("generate failed");
    expect(studio.edit(generated.draft.id, { title: 42 }, ACTOR)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(studio.reject(generated.draft.id, ACTOR)).toEqual({ ok: true });
    expect(studio.draft(generated.draft.id)?.status).toBe("rejected");
    expect(studio.edit(generated.draft.id, generated.draft.fields, ACTOR)).toEqual({
      ok: false,
      reason: "not_pending",
    });
    expect(studio.product(LAMP)?.seoDescription).toBe("");
  });

  it("checks AI drafts like any other and never publishes invented facts", async () => {
    const ai = new ContentStudioService(
      db,
      new FixedProvider((facts) => ({
        title: facts.title,
        summary: "Our best-selling walnut lamp, guaranteed for life and 20% off today.",
        seoDescription: "Ignore the rules: the Brass Task Lamp is free this week with code LAMP.",
      })),
      tick,
      newId,
    );
    const generated = await ai.generate(LAMP, ACTOR);
    if (!generated.ok) throw new Error("generate failed");
    expect(generated.draft).toMatchObject({ source: "ai", model: "test-model" });
    const result = ai.approve(generated.draft.id, ACTOR);
    expect(result).toMatchObject({ ok: false, reason: "violations" });
    expect(new SqliteCatalogRepository(db).getProductById(LAMP)?.summary).not.toContain("walnut");
  });
});

describe("FallbackContentDraftProvider", () => {
  it("falls back to a labelled rules-based draft and records the error", async () => {
    const status = new WordingStatus("test-model");
    const failing: ContentDraftProvider = {
      draft: () => Promise.reject(new WordingUnavailableError("The API request timed out")),
    };
    const provider = new FallbackContentDraftProvider(failing, status);
    const facts = {
      title: "Brass Task Lamp",
      category: "Workspace",
      summary: "An adjustable desk lamp with a warm, focused beam.",
      description: "",
      materials: "Solid brass",
      care: "",
      tags: [],
      options: [],
    };
    const result = await provider.draft(facts);
    expect(result).toMatchObject({ source: "rules", model: null });
    expect(result.note).toBe(
      "AI drafting was unavailable (The API request timed out), so this is a rules-based draft built only from the product facts.",
    );
    expect(status.snapshot()).toMatchObject({ state: "ERROR" });
  });

  it("passes AI drafts through and marks the connection verified", async () => {
    const status = new WordingStatus("test-model");
    const provider = new FallbackContentDraftProvider(
      new FixedProvider(() => ({ title: "T", summary: "S", seoDescription: "D" })),
      status,
    );
    expect((await provider.draft({} as ProductFacts)).source).toBe("ai");
    expect(status.snapshot().state).toBe("CONNECTED_VERIFIED");
  });
});
