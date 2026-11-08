import { parseShopifyConfig, type ShopifyConfig } from "@/domain/integrations/shopify";
import { getDatabase } from "@/server/db/client";
import {
  DemoStoreAdapter,
  PlatformStatus,
  type PlatformStatusSnapshot,
  ShopifyStoreAdapter,
} from "@/server/integrations/store-platform";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";

interface PlatformRuntime {
  readonly config: ShopifyConfig;
  readonly status: PlatformStatus;
  readonly shopify: ShopifyStoreAdapter | null;
}

declare global {
  var __meroMossPlatform: PlatformRuntime | undefined;
}

function runtime(): PlatformRuntime {
  if (!globalThis.__meroMossPlatform) {
    const config = parseShopifyConfig(process.env);
    globalThis.__meroMossPlatform = {
      config,
      status: new PlatformStatus(config),
      shopify: config.kind === "complete" ? new ShopifyStoreAdapter(config) : null,
    };
  }
  return globalThis.__meroMossPlatform;
}

export interface ShopifySetting {
  readonly name: string;
  readonly isSet: boolean;
}

export interface PlatformOverview {
  readonly demoCatalog: string;
  readonly shopify: PlatformStatusSnapshot;
  /** Only present once the configuration is complete. */
  readonly storeDomain: string | null;
  readonly apiVersion: string | null;
  readonly canVerify: boolean;
  /** Whether each setting exists. Values are never exposed. */
  readonly settings: readonly ShopifySetting[];
}

const SETTING_NAMES = [
  "SHOPIFY_STORE_DOMAIN",
  "SHOPIFY_ADMIN_ACCESS_TOKEN",
  "SHOPIFY_API_VERSION",
  "SHOPIFY_WEBHOOK_SECRET",
];

/** Callers must have verified a merchant session. */
export async function platformOverview(): Promise<PlatformOverview> {
  const { config, status, shopify } = runtime();
  return {
    demoCatalog: await new DemoStoreAdapter(new SqliteCatalogRepository(getDatabase())).verify(),
    shopify: status.snapshot(),
    storeDomain: config.kind === "complete" ? config.storeDomain : null,
    apiVersion: config.kind === "complete" ? config.apiVersion : null,
    canVerify: shopify !== null,
    settings: SETTING_NAMES.map((name) => ({ name, isSet: Boolean(process.env[name]?.trim()) })),
  };
}

/** Read-only connection check. Null when there is no complete configuration to check. */
export async function checkShopifyConnection(): Promise<PlatformStatusSnapshot | null> {
  const { status, shopify } = runtime();
  return shopify ? status.check(shopify) : null;
}
