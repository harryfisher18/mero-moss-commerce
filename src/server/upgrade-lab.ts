import type { Product } from "@/domain/commerce/catalog";
import type { StorePolicy } from "@/domain/commerce/policies";
import {
  type NotificationPreview,
  orderCreatedPayload,
  type OrderCreatedPayload,
  notificationPreviews,
  type OrderRouting,
  routeOrder,
} from "@/domain/events/order-created";
import {
  type KeywordResult,
  keywordSearch,
  labProducts,
  sampleOrderPayload,
} from "@/domain/upgrade-lab/comparisons";
import { automationService } from "@/server/automation";
import { getDatabase } from "@/server/db/client";
import {
  type AdvisorResponse,
  CatalogRecommendationProvider,
} from "@/server/integrations/recommendation-provider";
import { merchantOrders } from "@/server/merchant-session";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";

/**
 * Read-only data for the Upgrade Lab. Callers must have verified a merchant session.
 * Nothing here writes to the catalog, carts or orders, and the discovery comparison uses
 * the deterministic advisor only, so the lab never makes a paid model call.
 */

const catalog = () => new SqliteCatalogRepository(getDatabase());

export interface ProductComparisonData {
  readonly choices: readonly Product[];
  readonly product: Product | null;
  readonly policies: readonly StorePolicy[];
}

export function productComparison(handle: string | undefined): ProductComparisonData {
  const repo = catalog();
  const choices = labProducts(repo.listProducts());
  return {
    choices,
    product: choices.find((candidate) => candidate.handle === handle) ?? choices[0] ?? null,
    policies: repo.listPolicies().filter((policy) => policy.key !== "demo-store"),
  };
}

export interface DiscoveryComparisonData {
  readonly before: readonly KeywordResult[];
  readonly after: AdvisorResponse;
}

export async function discoveryComparison(question: string): Promise<DiscoveryComparisonData> {
  const repo = catalog();
  return {
    before: keywordSearch(question, repo.listProducts()),
    after: await new CatalogRecommendationProvider(repo).answer(question),
  };
}

export interface OrderComparisonData {
  readonly recent: ReadonlyArray<{ readonly id: string; readonly orderNumber: string }>;
  readonly selectedId: string | null;
  readonly isSample: boolean;
  readonly payload: OrderCreatedPayload;
  readonly routing: OrderRouting;
  readonly previews: readonly NotificationPreview[];
  /** The real job for this order, when one exists. */
  readonly eventId: string | null;
}

const RECENT_ORDERS = 5;

export function orderComparison(orderId: string | undefined): OrderComparisonData | null {
  const orders = merchantOrders();
  const recent = orders
    .list()
    .slice(0, RECENT_ORDERS)
    .map(({ id, orderNumber }) => ({ id, orderNumber }));
  const selectedId = recent.find((order) => order.id === orderId)?.id ?? recent[0]?.id ?? null;
  const order = selectedId ? (orders.get(selectedId)?.order ?? null) : null;
  const payload = order ? orderCreatedPayload(order) : sampleOrderPayload(catalog().listProducts());
  if (!payload) return null;
  const routing = routeOrder(payload);
  return {
    recent,
    selectedId,
    isSample: order === null,
    payload,
    routing,
    previews: notificationPreviews(payload, routing),
    eventId: order ? (automationService().forOrder(order.id).events[0]?.id ?? null) : null,
  };
}
