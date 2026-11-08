import { z } from "zod";
import type { Product } from "@/domain/commerce/catalog";
import type { ShopifyConfig } from "@/domain/integrations/shopify";
import type { IntegrationState } from "@/server/integrations/wording-provider";

/**
 * The boundary between this application and a store platform. Reads only: an adapter has
 * no method that can change a remote store, so no live side effect is possible through it.
 */

export interface PlatformProduct {
  readonly id: string;
  readonly title: string;
  readonly handle: string;
  readonly status: string;
}

export interface ProductPage {
  readonly products: readonly PlatformProduct[];
  readonly nextCursor: string | null;
}

export interface StorePlatformAdapter {
  readonly platform: "demo" | "shopify";
  /** Proves the platform can be read, and returns a description safe to display. */
  verify(): Promise<string>;
  listProducts(input: { first: number; after?: string | null }): Promise<ProductPage>;
}

/** Thrown with a short message that is safe to display and log. */
export class PlatformError extends Error {}

export class DemoStoreAdapter implements StorePlatformAdapter {
  readonly platform = "demo";

  constructor(private readonly catalog: { listProducts(): Product[] }) {}

  async verify(): Promise<string> {
    const { length } = this.catalog.listProducts();
    return `Local demo catalog with ${String(length)} active products.`;
  }

  async listProducts({
    first,
    after,
  }: {
    first: number;
    after?: string | null;
  }): Promise<ProductPage> {
    const all = this.catalog.listProducts();
    const start = after ? Number(after) || 0 : 0;
    const end = start + first;
    return {
      products: all.slice(start, end).map(({ id, title, handle, status }) => ({
        id,
        title,
        handle,
        status,
      })),
      nextCursor: end < all.length ? String(end) : null,
    };
  }
}

const REQUEST_TIMEOUT_MS = 10_000;

const SHOP_QUERY = "query Shop { shop { name } }";
const PRODUCTS_QUERY = `query Products($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { id title handle status }
  }
}`;

const shopResponse = z.object({ shop: z.object({ name: z.string() }) });
const productsResponse = z.object({
  products: z.object({
    pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
    nodes: z.array(
      z.object({ id: z.string(), title: z.string(), handle: z.string(), status: z.string() }),
    ),
  }),
});
const graphqlEnvelope = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.unknown()).optional(),
});

/** Read-only client for the Shopify Admin GraphQL API. Used only when fully configured. */
export class ShopifyStoreAdapter implements StorePlatformAdapter {
  readonly platform = "shopify";

  constructor(
    private readonly config: Extract<ShopifyConfig, { kind: "complete" }>,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async verify(): Promise<string> {
    const { shop } = shopResponse.parse(await this.query(SHOP_QUERY));
    await this.listProducts({ first: 1 });
    return `Connected to ${shop.name}. Shop details and products could be read.`;
  }

  async listProducts({
    first,
    after,
  }: {
    first: number;
    after?: string | null;
  }): Promise<ProductPage> {
    const { products } = productsResponse.parse(
      await this.query(PRODUCTS_QUERY, { first, after: after ?? null }),
    );
    return {
      products: products.nodes,
      nextCursor: products.pageInfo.hasNextPage ? products.pageInfo.endCursor : null,
    };
  }

  private async query(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
    const { storeDomain, apiVersion, accessToken } = this.config;
    let response: Response;
    try {
      response = await this.fetcher(`https://${storeDomain}/admin/api/${apiVersion}/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new PlatformError("Shopify could not be reached.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new PlatformError("Shopify rejected the access token or its scopes.");
    }
    if (response.status === 404) {
      throw new PlatformError("Shopify did not find this store or API version.");
    }
    if (!response.ok) {
      throw new PlatformError(`Shopify returned an error (${String(response.status)}).`);
    }
    const envelope = graphqlEnvelope.safeParse(await response.json().catch(() => null));
    if (!envelope.success) throw new PlatformError("Shopify returned an unexpected response.");
    if (envelope.data.errors?.length) {
      throw new PlatformError("Shopify reported errors for this request.");
    }
    return envelope.data.data;
  }
}

export interface PlatformStatusSnapshot {
  readonly state: IntegrationState;
  readonly detail: string | null;
  readonly checkedAt: string | null;
}

/** Truthful state: configuration alone is never reported as a working connection. */
export class PlatformStatus {
  private state: IntegrationState;
  private detail: string | null;
  private checkedAt: string | null = null;

  constructor(
    config: ShopifyConfig,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.state =
      config.kind === "absent" ? "DEMO" : config.kind === "complete" ? "CONFIGURED" : "ERROR";
    this.detail = config.kind === "invalid" ? config.problems.join(" ") : null;
  }

  async check(adapter: StorePlatformAdapter): Promise<PlatformStatusSnapshot> {
    this.checkedAt = this.now().toISOString();
    try {
      this.detail = await adapter.verify();
      this.state = "CONNECTED_VERIFIED";
    } catch (error) {
      this.state = "ERROR";
      this.detail =
        error instanceof PlatformError ? error.message : "Shopify returned an unexpected response.";
    }
    return this.snapshot();
  }

  snapshot(): PlatformStatusSnapshot {
    return { state: this.state, detail: this.detail, checkedAt: this.checkedAt };
  }
}
