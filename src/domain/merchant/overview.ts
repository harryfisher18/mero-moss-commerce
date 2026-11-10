import { type Product, variantAvailability } from "@/domain/commerce/catalog";
import type { OrderStatus } from "@/domain/commerce/order";

/**
 * Merchant overview rules. Pure. Every figure is a count of stored records: there are no
 * targets, forecasts, trends or comparisons, because none of those exist in the data.
 */

export interface OverviewCounts {
  readonly ordersByStatus: Readonly<Record<OrderStatus, number>>;
  readonly heldForReview: number;
  readonly automation: { readonly retrying: number; readonly dead: number };
  readonly supportRequests: number;
}

export interface StockAlert {
  readonly productId: string;
  readonly productTitle: string;
  readonly variantTitle: string | null;
  readonly sku: string;
  readonly inventory: number;
}

export interface StockAlerts {
  readonly soldOut: readonly StockAlert[];
  readonly lowStock: readonly StockAlert[];
}

/** Sold-out and low-stock variants of products shoppers can see. Lowest stock first. */
export function stockAlerts(products: readonly Product[]): StockAlerts {
  const soldOut: StockAlert[] = [];
  const lowStock: StockAlert[] = [];
  for (const product of products) {
    if (product.status !== "active") continue;
    for (const variant of product.variants) {
      const availability = variantAvailability(variant);
      if (availability === "in_stock") continue;
      const alert = {
        productId: product.id,
        productTitle: product.title,
        variantTitle: product.variants.length > 1 ? variant.title : null,
        sku: variant.sku,
        inventory: variant.inventoryQuantity,
      };
      (availability === "sold_out" ? soldOut : lowStock).push(alert);
    }
  }
  const order = (a: StockAlert, b: StockAlert) =>
    a.inventory - b.inventory || a.productTitle.localeCompare(b.productTitle);
  return { soldOut: soldOut.sort(order), lowStock: lowStock.sort(order) };
}

export interface AttentionItem {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly href: string;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** Things a merchant can act on now, most urgent first. Empty when nothing needs action. */
export function attentionItems(counts: OverviewCounts, alerts: StockAlerts): AttentionItem[] {
  const placed = counts.ordersByStatus.placed;
  const items: AttentionItem[] = [
    {
      key: "dead",
      count: counts.automation.dead,
      label: plural(
        counts.automation.dead,
        "automation job failed for good",
        "automation jobs failed for good",
      ),
      href: "/admin/automations?status=dead",
    },
    {
      key: "review",
      count: counts.heldForReview,
      label: plural(counts.heldForReview, "order is held for review", "orders are held for review"),
      href: "/admin/orders?view=review",
    },
    {
      key: "placed",
      count: placed,
      label: plural(
        placed,
        "order is waiting to be processed",
        "orders are waiting to be processed",
      ),
      href: "/admin/orders?status=placed",
    },
    {
      key: "sold-out",
      count: alerts.soldOut.length,
      label: plural(alerts.soldOut.length, "variant is sold out", "variants are sold out"),
      href: "/admin/products",
    },
    {
      key: "retrying",
      count: counts.automation.retrying,
      label: plural(
        counts.automation.retrying,
        "automation job is waiting to retry",
        "automation jobs are waiting to retry",
      ),
      href: "/admin/automations?status=retrying",
    },
  ];
  return items.filter((item) => item.count > 0);
}
