import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Product } from "@/domain/commerce/catalog";
import { toDecimalString } from "@/domain/commerce/money";
import type { RawProductEdit } from "@/domain/commerce/product-edit";
import { CartService } from "@/server/cart-service";
import { type Database, openDatabase } from "@/server/db/database";
import { seedDatabase } from "@/server/db/seed";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";
import { OrderService } from "./order-service";
import { ProductEditService } from "./product-edit-service";

const MAT = "prod_felt-desk-mat";
const MAT_LARGE = "var_mm-ws-fdm-chr-l"; // $58.00, stock 9

let db: Database;
let editor: ProductEditService;
let tick: number;

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
  tick = 0;
  editor = new ProductEditService(
    db,
    () => `2026-11-07T12:00:${String(++tick).padStart(2, "0")}.000Z`,
  );
});

afterEach(() => db.close());

/** Form values for the product exactly as stored, with optional overrides per variant. */
function formFor(
  product: Product,
  overrides: Partial<Omit<RawProductEdit, "variants">> = {},
  variantOverrides: Record<string, Partial<RawProductEdit["variants"][number]>> = {},
): RawProductEdit {
  return {
    title: product.title,
    summary: product.summary,
    description: product.description,
    status: product.status,
    ...overrides,
    variants: product.variants.map((v) => ({
      id: v.id,
      price: toDecimalString(v.price),
      compareAt: v.compareAtPrice ? toDecimalString(v.compareAtPrice) : "",
      stock: String(v.inventoryQuantity),
      ...variantOverrides[v.id],
    })),
  };
}

/** Previews an edit and publishes exactly what was previewed, as the editor does. */
function publish(productId: string, updatedAt: string, raw: RawProductEdit, actor: string) {
  const preview = editor.preview(productId, updatedAt, raw);
  if (!preview.ok) return preview;
  return editor.save(productId, updatedAt, raw, actor, preview.fingerprint);
}

function current(): Product {
  const product = editor.get(MAT);
  if (!product) throw new Error("seed product missing");
  return product;
}

describe("ProductEditService.preview", () => {
  it("lists the changes and their storefront effects without writing anything", () => {
    const product = current();
    const preview = editor.preview(
      MAT,
      product.updatedAt,
      formFor(
        product,
        { status: "draft" },
        { [MAT_LARGE]: { price: "52.00", compareAt: "58.00", stock: "0" } },
      ),
    );
    if (!preview.ok) throw new Error("preview failed");
    expect(preview.changes.map((c) => [c.label, c.field, c.before, c.after])).toEqual([
      ["felt-desk-mat", "status", "active", "draft"],
      ["MM-WS-FDM-CHR-L", "price", "58.00", "52.00"],
      ["MM-WS-FDM-CHR-L", "compareAtPrice", "", "58.00"],
      ["MM-WS-FDM-CHR-L", "inventoryQuantity", "9", "0"],
    ]);
    expect(preview.effects).toEqual([
      "The product will be hidden from the store.",
      "MM-WS-FDM-CHR-L will show as sold out.",
      "MM-WS-FDM-CHR-L will show as reduced from $58.00.",
    ]);
    expect(preview.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(current()).toEqual(product);
    expect(editor.audit(MAT)).toEqual([]);
  });

  it("reports invalid, stale and missing products like a save would", () => {
    const product = current();
    expect(
      editor.preview(MAT, product.updatedAt, formFor(product, {}, { [MAT_LARGE]: { stock: "x" } })),
    ).toMatchObject({ ok: false, reason: "invalid" });
    expect(editor.preview(MAT, "2000-01-01T00:00:00.000Z", formFor(product))).toEqual({
      ok: false,
      reason: "conflict",
    });
    expect(editor.preview("prod_missing", "x", formFor(product))).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("ProductEditService.save", () => {
  it("refuses to publish an edit that differs from the one previewed", () => {
    const product = current();
    const preview = editor.preview(
      MAT,
      product.updatedAt,
      formFor(product, { title: "Previewed" }),
    );
    if (!preview.ok) throw new Error("preview failed");
    expect(
      editor.save(
        MAT,
        product.updatedAt,
        formFor(product, { title: "Changed after" }),
        "owner",
        preview.fingerprint,
      ),
    ).toEqual({ ok: false, reason: "preview_stale" });
    expect(
      editor.save(MAT, product.updatedAt, formFor(product, { title: "Previewed" }), "owner", ""),
    ).toEqual({
      ok: false,
      reason: "preview_stale",
    });
    expect(current()).toEqual(product);
    expect(editor.audit(MAT)).toEqual([]);

    // Whitespace the validator trims away does not count as a different edit.
    const saved = editor.save(
      MAT,
      product.updatedAt,
      formFor(product, { title: "  Previewed " }),
      "owner",
      preview.fingerprint,
    );
    expect(saved).toMatchObject({ ok: true });
    expect(current().title).toBe("Previewed");
  });

  it("updates price, compare-at and stock, and the storefront and cart see it immediately", () => {
    const cart = new CartService(db);
    const { cartId } = cart.add(undefined, MAT_LARGE, 2);
    expect(cart.getCart(cartId).totals.subtotal.amountMinor).toBe(11600);

    const product = current();
    const result = publish(
      MAT,
      product.updatedAt,
      formFor(product, {}, { [MAT_LARGE]: { price: "52.00", compareAt: "58.00", stock: "1" } }),
      "owner@example.com",
    );
    expect(result.ok).toBe(true);

    // Storefront repository (same reads the product page uses)
    const storefront = new SqliteCatalogRepository(db).getProductByHandle("felt-desk-mat");
    const large = storefront?.variants.find((v) => v.id === MAT_LARGE);
    expect(large?.price.amountMinor).toBe(5200);
    expect(large?.compareAtPrice?.amountMinor).toBe(5800);
    expect(large?.inventoryQuantity).toBe(1);

    // Cart reprices and flags the quantity that no longer fits
    const priced = cart.getCart(cartId);
    expect(priced.lines[0]).toMatchObject({ quantity: 1, issue: "quantity_reduced" });
    expect(priced.totals.subtotal.amountMinor).toBe(5200);

    // Checkout refuses the order until the cart is fixed
    expect(
      new OrderService(db).placeOrder(cartId, {
        email: "a@example.com",
        fullName: "A B",
        address1: "1 Main St",
        address2: "",
        city: "Portland",
        region: "OR",
        postalCode: "97205",
        acknowledgeSimulated: "yes",
      }),
    ).toMatchObject({ ok: false, reason: "problems" });
  });

  it("hides a product from the storefront when set to draft", () => {
    const product = current();
    expect(publish(MAT, product.updatedAt, formFor(product, { status: "draft" }), "owner").ok).toBe(
      true,
    );
    const repo = new SqliteCatalogRepository(db);
    expect(repo.getProductByHandle("felt-desk-mat")).toBeNull();
    expect(repo.isActiveProductHandle("felt-desk-mat")).toBe(false);
    expect(editor.listAll().find((p) => p.id === MAT)?.status).toBe("draft");
  });

  it("records one audit row per changed field, newest first", () => {
    const product = current();
    publish(
      MAT,
      product.updatedAt,
      formFor(product, { title: "Felt Desk Mat (Merino)" }, { [MAT_LARGE]: { stock: "4" } }),
      "owner@example.com",
    );
    expect(editor.audit(MAT)).toEqual([
      expect.objectContaining({
        entityType: "variant",
        label: "MM-WS-FDM-CHR-L",
        field: "inventoryQuantity",
        before: "9",
        after: "4",
        actor: "owner@example.com",
      }),
      expect.objectContaining({
        entityType: "product",
        field: "title",
        before: "Felt Desk Mat",
        after: "Felt Desk Mat (Merino)",
      }),
    ]);
  });

  it("rejects stale forms instead of overwriting newer changes", () => {
    const original = current();
    expect(publish(MAT, original.updatedAt, formFor(original, { title: "First" }), "a").ok).toBe(
      true,
    );
    expect(publish(MAT, original.updatedAt, formFor(original, { title: "Second" }), "b")).toEqual({
      ok: false,
      reason: "conflict",
    });
    expect(current().title).toBe("First");
  });

  it("does not write or audit anything for invalid or unchanged forms", () => {
    const product = current();
    const invalid = publish(
      MAT,
      product.updatedAt,
      formFor(product, {}, { [MAT_LARGE]: { price: "-1" } }),
      "owner",
    );
    expect(invalid).toMatchObject({ ok: false, reason: "invalid" });

    const unchanged = publish(MAT, product.updatedAt, formFor(product), "owner");
    expect(unchanged).toMatchObject({ ok: true, changes: [] });
    expect(current().updatedAt).toBe(product.updatedAt);
    expect(editor.audit(MAT)).toEqual([]);
    expect(publish("prod_missing", "x", formFor(product), "owner")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
