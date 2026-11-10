import { describe, expect, it } from "vitest";
import type { Product } from "@/domain/commerce/catalog";
import { money } from "@/domain/commerce/money";
import { attentionItems, type OverviewCounts, stockAlerts } from "./overview";

function product(title: string, stock: number[], status: Product["status"] = "active"): Product {
  const handle = title.toLowerCase().replaceAll(" ", "-");
  return {
    id: `prod_${handle}`,
    handle,
    title,
    categoryHandle: "workspace",
    summary: "",
    description: "",
    materials: "",
    care: "",
    tags: [],
    status,
    featured: false,
    swatch: "#cccccc",
    seoDescription: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    variants: stock.map((inventoryQuantity, position) => ({
      id: `${handle}-${String(position)}`,
      productId: `prod_${handle}`,
      sku: `${handle}-${String(position)}`.toUpperCase(),
      title: `Option ${String(position + 1)}`,
      options: { Option: String(position + 1) },
      price: money(1000, "USD"),
      compareAtPrice: null,
      inventoryQuantity,
      position,
    })),
  };
}

const counts = (overrides: Partial<OverviewCounts> = {}): OverviewCounts => ({
  ordersByStatus: { placed: 0, processing: 0, fulfilled: 0, cancelled: 0 },
  heldForReview: 0,
  automation: { retrying: 0, dead: 0 },
  supportRequests: 0,
  ...overrides,
});

describe("stockAlerts", () => {
  it("lists sold-out and low-stock variants of active products, lowest first", () => {
    const alerts = stockAlerts([
      product("Lamp", [0, 3, 20]),
      product("Mug", [5]),
      product("Hidden", [0], "draft"),
    ]);
    expect(alerts.soldOut.map((a) => [a.productTitle, a.variantTitle, a.inventory])).toEqual([
      ["Lamp", "Option 1", 0],
    ]);
    expect(alerts.lowStock.map((a) => [a.productTitle, a.variantTitle, a.inventory])).toEqual([
      ["Lamp", "Option 2", 3],
      ["Mug", null, 5],
    ]);
  });
});

describe("attentionItems", () => {
  it("is empty when nothing needs action", () => {
    expect(attentionItems(counts(), { soldOut: [], lowStock: [] })).toEqual([]);
  });

  it("lists actionable counts, most urgent first, with links", () => {
    const items = attentionItems(
      counts({
        ordersByStatus: { placed: 1, processing: 4, fulfilled: 9, cancelled: 2 },
        heldForReview: 2,
        automation: { retrying: 1, dead: 3 },
      }),
      stockAlerts([product("Lamp", [0, 0])]),
    );
    expect(items).toEqual([
      {
        key: "dead",
        count: 3,
        label: "automation jobs failed for good",
        href: "/admin/automations?status=dead",
      },
      {
        key: "review",
        count: 2,
        label: "orders are held for review",
        href: "/admin/orders?view=review",
      },
      {
        key: "placed",
        count: 1,
        label: "order is waiting to be processed",
        href: "/admin/orders?status=placed",
      },
      { key: "sold-out", count: 2, label: "variants are sold out", href: "/admin/products" },
      {
        key: "retrying",
        count: 1,
        label: "automation job is waiting to retry",
        href: "/admin/automations?status=retrying",
      },
    ]);
  });
});
