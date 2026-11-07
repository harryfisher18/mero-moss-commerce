import { describe, expect, it } from "vitest";
import type { Product, Variant } from "./catalog";
import { money } from "./money";
import { diffProductEdit, parseProductEdit, type RawProductEdit } from "./product-edit";

function variant(id: string, priceMinor: number, stock: number): Variant {
  return {
    id,
    productId: "prod_mat",
    sku: `SKU-${id}`,
    title: id,
    options: {},
    price: money(priceMinor, "USD"),
    compareAtPrice: null,
    inventoryQuantity: stock,
    position: 0,
  };
}

const product: Product = {
  id: "prod_mat",
  handle: "felt-desk-mat",
  title: "Felt Desk Mat",
  categoryHandle: "workspace",
  summary: "A wool felt mat.",
  description: "Dense merino felt.",
  materials: "",
  care: "",
  tags: [],
  status: "active",
  featured: false,
  swatch: "#000",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  variants: [variant("m", 4800, 14), variant("l", 5800, 9)],
};

function raw(overrides: Partial<RawProductEdit> = {}): RawProductEdit {
  return {
    title: product.title,
    summary: product.summary,
    description: product.description,
    status: "active",
    variants: [
      { id: "m", price: "48.00", compareAt: "", stock: "14" },
      { id: "l", price: "58.00", compareAt: "", stock: "9" },
    ],
    ...overrides,
  };
}

describe("parseProductEdit", () => {
  it("accepts an unchanged form and produces no diff", () => {
    const result = parseProductEdit(raw(), product);
    expect(result.ok).toBe(true);
    if (result.ok) expect(diffProductEdit(product, result.edit)).toEqual([]);
  });

  it("parses prices exactly and trims text", () => {
    const result = parseProductEdit(
      raw({
        title: "  Felt Desk Mat, Large  ",
        variants: [
          { id: "m", price: "44.5", compareAt: "48.00", stock: "3" },
          { id: "l", price: "58", compareAt: "", stock: "0" },
        ],
      }),
      product,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.edit.title).toBe("Felt Desk Mat, Large");
    expect(result.edit.variants[0]).toEqual({
      id: "m",
      price: { amountMinor: 4450, currency: "USD" },
      compareAtPrice: { amountMinor: 4800, currency: "USD" },
      inventoryQuantity: 3,
    });
  });

  it("reports field-level errors", () => {
    const result = parseProductEdit(
      raw({
        title: " ",
        status: "deleted",
        variants: [
          { id: "m", price: "0", compareAt: "40", stock: "-1" },
          { id: "l", price: "58.999", compareAt: "50", stock: "2.5" },
        ],
      }),
      product,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toMatchObject({
      title: "Title is required.",
      status: "Choose a valid status.",
      "m.price": "Enter a price above $0.00 with up to two decimals.",
      "m.stock": "Stock cannot be negative.",
      "l.price": "Enter a price above $0.00 with up to two decimals.",
      "l.stock": "Enter a whole number.",
    });
    expect(result.errors["m.compareAt"]).toBeUndefined();
  });

  it("requires compare-at to exceed the price", () => {
    const result = parseProductEdit(
      raw({
        variants: [
          { id: "m", price: "48.00", compareAt: "48.00", stock: "14" },
          { id: "l", price: "58.00", compareAt: "", stock: "" },
        ],
      }),
      product,
    );
    expect(result.ok ? {} : result.errors).toEqual({
      "m.compareAt": "Compare-at price must be higher than the price.",
      "l.stock": "Enter a whole number.",
    });
  });

  it("rejects forms whose variants do not match the product", () => {
    const missing = parseProductEdit(
      raw({ variants: [{ id: "m", price: "1", compareAt: "", stock: "1" }] }),
      product,
    );
    expect(missing.ok ? null : missing.errors.form).toMatch(/variants changed/);
    const foreign = parseProductEdit(
      raw({
        variants: [
          { id: "m", price: "1", compareAt: "", stock: "1" },
          { id: "someone-else", price: "1", compareAt: "", stock: "1" },
        ],
      }),
      product,
    );
    expect(foreign.ok).toBe(false);
  });
});

describe("diffProductEdit", () => {
  it("lists only changed fields with before and after values", () => {
    const result = parseProductEdit(
      raw({
        status: "draft",
        variants: [
          { id: "m", price: "44.00", compareAt: "48.00", stock: "14" },
          { id: "l", price: "58.00", compareAt: "", stock: "2" },
        ],
      }),
      product,
    );
    if (!result.ok) throw new Error("expected valid edit");
    expect(diffProductEdit(product, result.edit)).toEqual([
      {
        entityType: "product",
        entityId: "prod_mat",
        label: "felt-desk-mat",
        field: "status",
        before: "active",
        after: "draft",
      },
      {
        entityType: "variant",
        entityId: "m",
        label: "SKU-m",
        field: "price",
        before: "48.00",
        after: "44.00",
      },
      {
        entityType: "variant",
        entityId: "m",
        label: "SKU-m",
        field: "compareAtPrice",
        before: "",
        after: "48.00",
      },
      {
        entityType: "variant",
        entityId: "l",
        label: "SKU-l",
        field: "inventoryQuantity",
        before: "9",
        after: "2",
      },
    ]);
  });
});
