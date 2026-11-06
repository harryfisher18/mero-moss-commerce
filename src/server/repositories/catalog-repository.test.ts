import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATEGORY_HANDLES } from "@/domain/commerce/catalog";
import { type Database, migrate, openDatabase } from "@/server/db/database";
import { MIGRATIONS } from "@/server/db/migrations";
import { isSeeded, seedDatabase } from "@/server/db/seed";
import { SEED_PRODUCTS } from "@/server/db/seed-data";
import { SqliteCatalogRepository } from "./catalog-repository";

let db: Database;
let repo: SqliteCatalogRepository;

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
  repo = new SqliteCatalogRepository(db);
});

afterEach(() => {
  db.close();
});

describe("migrations", () => {
  it("records every migration and is idempotent", () => {
    const versions = db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all()
      .map((row) => Number(row.version));
    expect(versions).toEqual(MIGRATIONS.map((m) => m.version));
    expect(migrate(db)).toEqual([]);
  });

  it("rejects negative stock and prices at the schema level", () => {
    expect(() =>
      db.prepare("UPDATE variants SET inventory_quantity = -1 WHERE sku = 'MM-WS-OMS-1'").run(),
    ).toThrow();
    expect(() =>
      db.prepare("UPDATE variants SET price_minor = -100 WHERE sku = 'MM-WS-OMS-1'").run(),
    ).toThrow();
  });
});

describe("seed data integrity", () => {
  it("seeds 24-40 products across all four categories", () => {
    expect(isSeeded(db)).toBe(true);
    const products = repo.listProducts();
    expect(products.length).toBeGreaterThanOrEqual(24);
    expect(products.length).toBeLessThanOrEqual(40);
    const counts = repo.countActiveProductsByCategory();
    for (const handle of CATEGORY_HANDLES) {
      expect(counts[handle]).toBeGreaterThan(0);
    }
  });

  it("has unique handles and SKUs, integer prices and non-negative stock", () => {
    const handles = new Set(SEED_PRODUCTS.map((p) => p.handle));
    expect(handles.size).toBe(SEED_PRODUCTS.length);
    const skus = SEED_PRODUCTS.flatMap((p) => p.variants.map((v) => v.sku));
    expect(new Set(skus).size).toBe(skus.length);
    for (const product of SEED_PRODUCTS) {
      expect(product.variants.length).toBeGreaterThan(0);
      for (const variant of product.variants) {
        expect(Number.isInteger(variant.priceMinor)).toBe(true);
        expect(variant.priceMinor).toBeGreaterThan(0);
        expect(variant.inventory).toBeGreaterThanOrEqual(0);
      }
      const optionNames = product.variants.map((v) => Object.keys(v.options).sort().join("|"));
      expect(new Set(optionNames).size).toBe(1);
    }
  });

  it("includes sold-out and low-stock variants so availability states are exercised", () => {
    const variants = repo.listProducts().flatMap((p) => p.variants);
    expect(variants.some((v) => v.inventoryQuantity === 0)).toBe(true);
    expect(variants.some((v) => v.inventoryQuantity > 0 && v.inventoryQuantity <= 5)).toBe(true);
  });

  it("stores the policies the storefront is allowed to quote", () => {
    const keys = repo.listPolicies().map((p) => p.key);
    expect(keys).toEqual(["shipping", "returns", "care-and-warranty", "demo-store"]);
  });
});

describe("SqliteCatalogRepository", () => {
  it("lists categories in position order", () => {
    expect(repo.listCategories().map((c) => c.handle)).toEqual([...CATEGORY_HANDLES]);
  });

  it("loads a product with its variants as Money in minor units", () => {
    const product = repo.getProductByHandle("felt-desk-mat");
    expect(product).not.toBeNull();
    expect(product?.categoryHandle).toBe("workspace");
    expect(product?.variants.map((v) => v.sku)).toEqual([
      "MM-WS-FDM-CHR-M",
      "MM-WS-FDM-CHR-L",
      "MM-WS-FDM-OAT-M",
      "MM-WS-FDM-OAT-L",
    ]);
    expect(product?.variants[1]?.price).toEqual({ amountMinor: 5800, currency: "USD" });
    expect(product?.variants[1]?.options).toEqual({ Color: "Charcoal", Size: "Large" });
  });

  it("filters by category and featured flag", () => {
    const travel = repo.listProducts({ categoryHandle: "travel-essentials" });
    expect(travel.length).toBeGreaterThan(0);
    expect(travel.every((p) => p.categoryHandle === "travel-essentials")).toBe(true);

    const featured = repo.listProducts({ featured: true, limit: 3 });
    expect(featured).toHaveLength(3);
    expect(featured.every((p) => p.featured)).toBe(true);
  });

  it("hides draft products from storefront queries by default", () => {
    db.prepare("UPDATE products SET status = 'draft' WHERE handle = 'oak-monitor-stand'").run();
    expect(repo.getProductByHandle("oak-monitor-stand")).toBeNull();
    expect(repo.listProducts().some((p) => p.handle === "oak-monitor-stand")).toBe(false);
    expect(repo.getProductByHandle("oak-monitor-stand", ["draft"])?.status).toBe("draft");
    expect(repo.countActiveProductsByCategory().workspace).toBe(6);
  });

  it("reflects stock and price changes immediately", () => {
    db.prepare(
      "UPDATE variants SET inventory_quantity = 0, price_minor = 9900 WHERE sku = 'MM-WS-OMS-1'",
    ).run();
    const variant = repo.getProductByHandle("oak-monitor-stand")?.variants[0];
    expect(variant?.inventoryQuantity).toBe(0);
    expect(variant?.price.amountMinor).toBe(9900);
  });

  it("returns null for unknown handles", () => {
    expect(repo.getProductByHandle("does-not-exist")).toBeNull();
  });
});

describe("isActiveProductHandle", () => {
  it("is true only for existing active products", () => {
    expect(repo.isActiveProductHandle("felt-desk-mat")).toBe(true);
    expect(repo.isActiveProductHandle("does-not-exist")).toBe(false);
    db.prepare("UPDATE products SET status = 'draft' WHERE handle = 'felt-desk-mat'").run();
    expect(repo.isActiveProductHandle("felt-desk-mat")).toBe(false);
  });
});
