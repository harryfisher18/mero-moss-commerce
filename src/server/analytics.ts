import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import {
  ANALYTICS_COOKIE,
  analyticsCookieOptions,
  honorsPrivacySignal,
} from "@/domain/analytics/funnel";
import { multiplyMoney } from "@/domain/commerce/money";
import { AnalyticsService, type AnalyticsEventInput } from "@/server/analytics-service";
import { getDatabase } from "@/server/db/client";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";

export function analyticsService(): AnalyticsService {
  return new AnalyticsService(getDatabase());
}

const sessionIdSchema = z.uuid();

/** The anonymous session id, created if needed. Null when the browser opted out. */
async function analyticsSessionId(): Promise<string | null> {
  if (honorsPrivacySignal((await headers()).get("sec-gpc"))) return null;
  const store = await cookies();
  const existing = sessionIdSchema.safeParse(store.get(ANALYTICS_COOKIE)?.value);
  if (existing.success) return existing.data;
  const created = randomUUID();
  store.set(
    ANALYTICS_COOKIE,
    created,
    analyticsCookieOptions(process.env.NODE_ENV === "production"),
  );
  return created;
}

/**
 * Records one event. Only callable from Server Actions or Route Handlers. Analytics must
 * never break shopping, so failures are logged (without event data) and swallowed.
 */
export async function trackEvent(event: AnalyticsEventInput): Promise<void> {
  try {
    const sessionId = await analyticsSessionId();
    if (sessionId) analyticsService().record(sessionId, event);
  } catch (error) {
    console.error(
      `[analytics] event not recorded: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export async function trackAddToCart(variantId: string, quantity: number): Promise<void> {
  const entry = new SqliteCatalogRepository(getDatabase())
    .getCatalogEntries([variantId])
    .get(variantId);
  if (!entry) return;
  await trackEvent({
    name: "add_to_cart",
    productId: entry.product.id,
    quantity,
    value: multiplyMoney(entry.variant.price, quantity),
  });
}
