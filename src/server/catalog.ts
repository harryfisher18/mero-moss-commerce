import { connection } from "next/server";
import type { CategoryHandle } from "@/domain/commerce/catalog";
import { getDatabase } from "@/server/db/client";
import {
  type CatalogRepository,
  type ProductQuery,
  SqliteCatalogRepository,
} from "@/server/repositories/catalog-repository";

/**
 * Request-time catalog access for Server Components.
 * `connection()` keeps synchronous SQLite reads out of prerendering so the
 * storefront always reflects the current catalog and stock.
 */
async function catalog(): Promise<CatalogRepository> {
  await connection();
  return new SqliteCatalogRepository(getDatabase());
}

export async function getCategories() {
  return (await catalog()).listCategories();
}

export async function getProducts(query?: ProductQuery) {
  return (await catalog()).listProducts(query);
}

export async function getFeaturedProducts(limit = 6) {
  return (await catalog()).listProducts({ featured: true, limit });
}

export async function getProductCountsByCategory(): Promise<Record<CategoryHandle, number>> {
  return (await catalog()).countActiveProductsByCategory();
}

export async function getStorePolicies() {
  return (await catalog()).listPolicies();
}
