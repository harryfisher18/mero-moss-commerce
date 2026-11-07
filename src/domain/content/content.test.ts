import { describe, expect, it } from "vitest";
import type { Product } from "@/domain/commerce/catalog";
import { money } from "@/domain/commerce/money";
import { openDatabase } from "@/server/db/database";
import { seedDatabase } from "@/server/db/seed";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";
import { checkContent } from "./constraints";
import { diffWords } from "./diff";
import {
  CONTENT_LIMITS,
  type ContentFields,
  lowerFirstWord,
  productFacts,
  rulesDraft,
} from "./draft";

const LAMP: Product = {
  id: "prod_lamp",
  handle: "brass-task-lamp",
  title: "Brass Task Lamp",
  categoryHandle: "workspace",
  summary: "An adjustable desk lamp with a warm, focused beam.",
  description: "A weighted base and a jointed arm put light exactly where you need it.",
  materials: "Solid brass shade and arm, cotton-covered cord",
  care: "Dust with a dry cloth.",
  tags: ["lighting", "desk"],
  status: "active",
  featured: false,
  swatch: "#b08d57",
  seoDescription: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  variants: [
    {
      id: "v1",
      productId: "prod_lamp",
      sku: "L-1",
      title: "Brushed Brass",
      options: { Finish: "Brushed Brass" },
      price: money(14800, "USD"),
      compareAtPrice: null,
      inventoryQuantity: 7,
      position: 0,
    },
    {
      id: "v2",
      productId: "prod_lamp",
      sku: "L-2",
      title: "Matte Black",
      options: { Finish: "Matte Black" },
      price: money(14800, "USD"),
      compareAtPrice: null,
      inventoryQuantity: 12,
      position: 1,
    },
  ],
};

const facts = productFacts(LAMP);
const valid: ContentFields = {
  title: "Brass Task Lamp",
  summary: "An adjustable brass desk lamp with a warm, focused beam.",
  seoDescription:
    "Brass Task Lamp: an adjustable desk lamp with a warm, focused beam, in Brushed Brass or Matte Black.",
};
const rulesOf = (fields: ContentFields) => checkContent(fields, facts).map((v) => v.rule);

describe("productFacts", () => {
  it("collects the facts a draft may use, including real option values", () => {
    expect(facts).toMatchObject({
      title: "Brass Task Lamp",
      category: "Workspace",
      options: [{ name: "Finish", values: ["Brushed Brass", "Matte Black"] }],
    });
  });
});

describe("rulesDraft", () => {
  it("keeps the title and summary and builds an SEO description from facts", () => {
    const draft = rulesDraft(facts);
    expect(draft.title).toBe(LAMP.title);
    expect(draft.summary).toBe(LAMP.summary);
    expect(draft.seoDescription).toBe(
      "Brass Task Lamp: An adjustable desk lamp with a warm, focused beam. Made with solid brass shade and arm, cotton-covered cord. Part of our Workspace collection.",
    );
    expect(draft.seoDescription.length).toBeLessThanOrEqual(CONTENT_LIMITS.seoDescription.max);
    expect(checkContent(draft, facts)).toEqual([]);
  });

  it("passes every constraint check for every seeded product", () => {
    const db = openDatabase(":memory:");
    seedDatabase(db);
    const products = new SqliteCatalogRepository(db).listProducts({
      statuses: ["active", "draft", "archived"],
    });
    db.close();
    expect(products.length).toBeGreaterThan(20);
    for (const product of products) {
      const productFactsSheet = productFacts(product);
      expect({
        handle: product.handle,
        violations: checkContent(rulesDraft(productFactsSheet), productFactsSheet),
      }).toEqual({ handle: product.handle, violations: [] });
    }
  });
});

describe("lowerFirstWord", () => {
  it("lowercases ordinary words but keeps acronyms", () => {
    expect(lowerFirstWord("Solid brass shade")).toBe("solid brass shade");
    expect(lowerFirstWord("FSC-certified solid oak")).toBe("FSC-certified solid oak");
    expect(lowerFirstWord("100% European flax linen")).toBe("100% European flax linen");
  });
});

describe("checkContent", () => {
  it("accepts copy that only restates facts", () => {
    expect(checkContent(valid, facts)).toEqual([]);
  });

  it("rejects prices and percentages", () => {
    expect(
      rulesOf({ ...valid, summary: "A brass desk lamp, now only $99 for a warm beam." }),
    ).toContain("price");
    expect(
      rulesOf({ ...valid, summary: "A brass desk lamp with a warm beam at 20% less." }),
    ).toContain("price");
  });

  it("rejects numbers that are not in the facts", () => {
    expect(
      checkContent(
        { ...valid, summary: "A brass desk lamp with a 5-year warm, focused beam." },
        facts,
      ),
    ).toContainEqual({
      field: "summary",
      rule: "number",
      message: "Summary states “5”, which is not in the product facts.",
    });
  });

  it("rejects materials the product is not made of, but allows real ones", () => {
    expect(
      rulesOf({ ...valid, summary: "A walnut and brass desk lamp with a warm beam." }),
    ).toEqual(["material"]);
    expect(rulesOf({ ...valid, summary: "A brass desk lamp with a cotton-covered cord." })).toEqual(
      [],
    );
    // "cast iron" is reported once, not again as "iron".
    expect(
      checkContent(
        { ...valid, summary: "A brass lamp on a cast iron base, warm and focused." },
        facts,
      ),
    ).toEqual([
      expect.objectContaining({ rule: "material", message: expect.stringContaining("cast iron") }),
    ]);
  });

  it("rejects promotional and unverifiable claims not supported by the facts", () => {
    const violations = checkContent(
      {
        ...valid,
        seoDescription:
          "The best eco-friendly brass desk lamp with a lifetime warranty and free shipping included.",
      },
      facts,
    );
    expect(violations.map((v) => v.message)).toEqual(
      expect.arrayContaining([
        "SEO description claims “best”, which the product facts do not support.",
        "SEO description claims “eco-friendly”, which the product facts do not support.",
        "SEO description claims “lifetime”, which the product facts do not support.",
        "SEO description claims “warranty”, which the product facts do not support.",
        "SEO description claims “free”, which the product facts do not support.",
      ]),
    );
  });

  it("enforces length limits per field", () => {
    expect(checkContent({ ...valid, seoDescription: "Too short." }, facts)).toContainEqual(
      expect.objectContaining({ field: "seoDescription", rule: "length" }),
    );
    expect(rulesOf({ ...valid, title: "x".repeat(81) })).toContain("length");
  });
});

describe("diffWords", () => {
  it("marks added and removed words and keeps unchanged text", () => {
    expect(diffWords("A warm desk lamp.", "A warm brass desk lamp.")).toEqual([
      { type: "same", text: "A warm " },
      { type: "added", text: "brass " },
      { type: "same", text: "desk lamp." },
    ]);
    expect(diffWords("Old copy", "")).toEqual([{ type: "removed", text: "Old copy" }]);
    expect(diffWords("", "")).toEqual([]);
  });
});
