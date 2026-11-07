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

function current(): Product {
  const product = editor.get(MAT);
  if (!product) throw new Error("seed product missing");
  return product;
}

describe("ProductEditService.save", () => {
  it("updates price, compare-at and stock, and the storefront and cart see it immediately", () => {
    const cart = new CartService(db);
    const { cartId } = cart.add(undefined, MAT_LARGE, 2);
    expect(cart.getCart(cartId).totals.subtotal.amountMinor).toBe(11600);

    const product = current();
    const result = editor.save(
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
    expect(
      editor.save(MAT, product.updatedAt, formFor(product, { status: "draft" }), "owner").ok,
    ).toBe(true);
    const repo = new SqliteCatalogRepository(db);
    expect(repo.getProductByHandle("felt-desk-mat")).toBeNull();
    expect(repo.isActiveProductHandle("felt-desk-mat")).toBe(false);
    expect(editor.listAll().find((p) => p.id === MAT)?.status).toBe("draft");
  });

  it("records one audit row per changed field, newest first", () => {
    const product = current();
    editor.save(
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
    expect(
      editor.save(MAT, original.updatedAt, formFor(original, { title: "First" }), "a").ok,
    ).toBe(true);
    expect(
      editor.save(MAT, original.updatedAt, formFor(original, { title: "Second" }), "b"),
    ).toEqual({
      ok: false,
      reason: "conflict",
    });
    expect(current().title).toBe("First");
  });

  it("does not write or audit anything for invalid or unchanged forms", () => {
    const product = current();
    const invalid = editor.save(
      MAT,
      product.updatedAt,
      formFor(product, {}, { [MAT_LARGE]: { price: "-1" } }),
      "owner",
    );
    expect(invalid).toMatchObject({ ok: false, reason: "invalid" });

    const unchanged = editor.save(MAT, product.updatedAt, formFor(product), "owner");
    expect(unchanged).toMatchObject({ ok: true, changes: [] });
    expect(current().updatedAt).toBe(product.updatedAt);
    expect(editor.audit(MAT)).toEqual([]);
    expect(editor.save("prod_missing", "x", formFor(product), "owner")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
