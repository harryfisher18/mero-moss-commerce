import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseShopifyConfig, type ShopifyConfig } from "@/domain/integrations/shopify";
import { type Database, openDatabase } from "@/server/db/database";
import { seedDatabase } from "@/server/db/seed";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";
import {
  DemoStoreAdapter,
  PlatformStatus,
  ShopifyStoreAdapter,
  type StorePlatformAdapter,
} from "./store-platform";

const TOKEN = "shpat_secret_value";
const CONFIG = parseShopifyConfig({
  SHOPIFY_STORE_DOMAIN: "mero-dev.myshopify.com",
  SHOPIFY_ADMIN_ACCESS_TOKEN: TOKEN,
  SHOPIFY_API_VERSION: "2026-10",
}) as Extract<ShopifyConfig, { kind: "complete" }>;

const PRODUCTS = {
  products: {
    pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
    nodes: [{ id: "gid://shopify/Product/1", title: "Mug", handle: "mug", status: "ACTIVE" }],
  },
};

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(responses: Array<Response | Error>): { fetcher: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error("no response queued");
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const ok = (data: unknown) => json({ data });

describe("DemoStoreAdapter", () => {
  let db: Database;
  beforeEach(() => {
    db = openDatabase(":memory:");
    seedDatabase(db);
  });
  afterEach(() => db.close());

  it("reads the real demo catalog with cursor pagination", async () => {
    const repo = new SqliteCatalogRepository(db);
    const adapter = new DemoStoreAdapter(repo);
    const total = repo.listProducts().length;
    expect(await adapter.verify()).toBe(
      `Local demo catalog with ${String(total)} active products.`,
    );

    const first = await adapter.listProducts({ first: 2 });
    expect(first.products).toHaveLength(2);
    expect(first.nextCursor).toBe("2");
    const second = await adapter.listProducts({ first: 2, after: first.nextCursor });
    expect(second.products[0]?.id).not.toBe(first.products[0]?.id);
    const last = await adapter.listProducts({ first: total, after: "2" });
    expect(last.nextCursor).toBeNull();
  });
});

describe("ShopifyStoreAdapter", () => {
  it("calls only the configured store's GraphQL endpoint with the token header", async () => {
    const { fetcher, calls } = fakeFetch([ok(PRODUCTS)]);
    const page = await new ShopifyStoreAdapter(CONFIG, fetcher).listProducts({
      first: 5,
      after: "abc",
    });
    expect(page).toEqual({ products: PRODUCTS.products.nodes, nextCursor: "cursor-1" });
    expect(calls[0]?.url).toBe("https://mero-dev.myshopify.com/admin/api/2026-10/graphql.json");
    expect(calls[0]?.init.headers).toMatchObject({ "X-Shopify-Access-Token": TOKEN });
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
      variables: { first: 5, after: "abc" },
    });
  });

  it("only ever sends read queries", async () => {
    const { fetcher, calls } = fakeFetch([ok({ shop: { name: "Mero Dev" } }), ok(PRODUCTS)]);
    await new ShopifyStoreAdapter(CONFIG, fetcher).verify();
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      const { query } = JSON.parse(String(call.init.body)) as { query: string };
      expect(query.trim().startsWith("query ")).toBe(true);
      expect(query).not.toMatch(/mutation/i);
    }
  });
});

describe("PlatformStatus", () => {
  const shopify = (responses: Array<Response | Error>) =>
    new ShopifyStoreAdapter(CONFIG, fakeFetch(responses).fetcher);
  const NOW = () => new Date("2026-11-08T12:00:00.000Z");

  it("reports DEMO, invalid configuration as ERROR, and CONFIGURED before any check", () => {
    expect(new PlatformStatus({ kind: "absent" }).snapshot().state).toBe("DEMO");
    expect(new PlatformStatus({ kind: "invalid", problems: ["A is missing."] }).snapshot()).toEqual(
      { state: "ERROR", detail: "A is missing.", checkedAt: null },
    );
    expect(new PlatformStatus(CONFIG).snapshot()).toEqual({
      state: "CONFIGURED",
      detail: null,
      checkedAt: null,
    });
  });

  it("becomes CONNECTED_VERIFIED only after real reads succeed", async () => {
    const status = new PlatformStatus(CONFIG, NOW);
    expect(await status.check(shopify([ok({ shop: { name: "Mero Dev" } }), ok(PRODUCTS)]))).toEqual(
      {
        state: "CONNECTED_VERIFIED",
        detail: "Connected to Mero Dev. Shop details and products could be read.",
        checkedAt: "2026-11-08T12:00:00.000Z",
      },
    );
  });

  it.each([
    ["rejected token", [json({}, 401)], "Shopify rejected the access token or its scopes."],
    ["missing scope", [json({}, 403)], "Shopify rejected the access token or its scopes."],
    ["wrong version", [json({}, 404)], "Shopify did not find this store or API version."],
    ["server error", [json({}, 503)], "Shopify returned an error (503)."],
    ["network failure", [new Error(`connect failed ${TOKEN}`)], "Shopify could not be reached."],
    [
      "GraphQL errors",
      [json({ errors: [{ message: TOKEN }] })],
      "Shopify reported errors for this request.",
    ],
    ["unexpected data", [ok({ nope: true })], "Shopify returned an unexpected response."],
    [
      "not JSON",
      [new Response("<html>", { status: 200 })],
      "Shopify returned an unexpected response.",
    ],
  ] as Array<[string, Array<Response | Error>, string]>)(
    "reports ERROR for %s and never shows the token",
    async (_name, responses, message) => {
      const result = await new PlatformStatus(CONFIG, NOW).check(shopify(responses));
      expect(result).toMatchObject({ state: "ERROR", detail: message });
      expect(JSON.stringify(result)).not.toContain(TOKEN);
    },
  );

  it("can recover from an error on a later check", async () => {
    const status = new PlatformStatus(CONFIG, NOW);
    const failing: StorePlatformAdapter = shopify([json({}, 401)]);
    expect((await status.check(failing)).state).toBe("ERROR");
    const working = shopify([ok({ shop: { name: "Mero Dev" } }), ok(PRODUCTS)]);
    expect((await status.check(working)).state).toBe("CONNECTED_VERIFIED");
  });
});
