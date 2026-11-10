import {
  type AttentionItem,
  attentionItems,
  type OverviewCounts,
  type StockAlerts,
  stockAlerts,
} from "@/domain/merchant/overview";
import { automationService } from "@/server/automation";
import { getDatabase } from "@/server/db/client";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";
import { SqliteOrderRepository } from "@/server/repositories/order-repository";
import { SqliteSupportRepository } from "@/server/repositories/support-repository";

export interface Overview {
  readonly counts: OverviewCounts;
  readonly alerts: StockAlerts;
  readonly attention: readonly AttentionItem[];
  readonly activeProducts: number;
}

/** Everything on the overview, counted from the database now. Callers verify the session. */
export function merchantOverview(): Overview {
  const db = getDatabase();
  const orders = new SqliteOrderRepository(db);
  const automation = automationService().counts();
  const products = new SqliteCatalogRepository(db).listProducts();
  const counts: OverviewCounts = {
    ordersByStatus: orders.countByStatus(),
    heldForReview: orders.countHeldForReview(),
    automation: { retrying: automation.retrying, dead: automation.dead },
    supportRequests: new SqliteSupportRepository(db).count(),
  };
  const alerts = stockAlerts(products);
  return {
    counts,
    alerts,
    attention: attentionItems(counts, alerts),
    activeProducts: products.length,
  };
}
