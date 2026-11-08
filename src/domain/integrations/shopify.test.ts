import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseShopifyConfig, verifyShopifyWebhook } from "./shopify";

const COMPLETE = {
  SHOPIFY_STORE_DOMAIN: "mero-dev.myshopify.com",
  SHOPIFY_ADMIN_ACCESS_TOKEN: "shpat_secret_value",
  SHOPIFY_API_VERSION: "2026-10",
};

describe("parseShopifyConfig", () => {
  it("is absent when nothing is set", () => {
    expect(parseShopifyConfig({})).toEqual({ kind: "absent" });
    expect(parseShopifyConfig({ SHOPIFY_STORE_DOMAIN: "  " })).toEqual({ kind: "absent" });
  });

  it("is complete with a valid domain, token and version", () => {
    expect(
      parseShopifyConfig({ ...COMPLETE, SHOPIFY_STORE_DOMAIN: " Mero-Dev.myshopify.com " }),
    ).toEqual({
      kind: "complete",
      storeDomain: "mero-dev.myshopify.com",
      accessToken: "shpat_secret_value",
      apiVersion: "2026-10",
      webhookSecret: null,
    });
  });

  it("names what is missing in a partial configuration", () => {
    expect(parseShopifyConfig({ SHOPIFY_STORE_DOMAIN: "mero-dev.myshopify.com" })).toEqual({
      kind: "invalid",
      problems: ["SHOPIFY_ADMIN_ACCESS_TOKEN is missing.", "SHOPIFY_API_VERSION is missing."],
    });
  });

  it.each([
    "evil.example",
    "mero.myshopify.com.evil.example",
    "https://mero.myshopify.com",
    "mero.myshopify.com/admin",
    "127.0.0.1",
  ])("refuses a store domain that is not Shopify-hosted: %s", (domain) => {
    expect(parseShopifyConfig({ ...COMPLETE, SHOPIFY_STORE_DOMAIN: domain })).toEqual({
      kind: "invalid",
      problems: ["SHOPIFY_STORE_DOMAIN must be a *.myshopify.com domain."],
    });
  });

  it("refuses a malformed API version and never repeats secret values", () => {
    const config = parseShopifyConfig({ ...COMPLETE, SHOPIFY_API_VERSION: "latest" });
    expect(config).toEqual({
      kind: "invalid",
      problems: ["SHOPIFY_API_VERSION must look like 2026-10."],
    });
    expect(JSON.stringify(config)).not.toContain("shpat_secret_value");
  });
});

describe("verifyShopifyWebhook", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ id: 820982911946154508, note: "ünïcode" });
  const sign = (payload: string | Buffer, key = secret) =>
    createHmac("sha256", key).update(payload).digest("base64");

  it("accepts the correct signature for a string or byte body", () => {
    expect(verifyShopifyWebhook(body, sign(body), secret)).toBe(true);
    expect(verifyShopifyWebhook(Buffer.from(body), sign(body), secret)).toBe(true);
  });

  it("rejects a changed body, even by whitespace", () => {
    expect(verifyShopifyWebhook(`${body} `, sign(body), secret)).toBe(false);
  });

  it("rejects a signature made with another secret", () => {
    expect(verifyShopifyWebhook(body, sign(body, "other"), secret)).toBe(false);
  });

  it.each([
    ["missing", null],
    ["undefined", undefined],
    ["empty", ""],
    ["not base64", "not base64!!"],
    ["too short", "AAAA"],
  ])("rejects a %s header without throwing", (_name, header) => {
    expect(verifyShopifyWebhook(body, header, secret)).toBe(false);
  });

  it("never verifies against an empty secret", () => {
    expect(verifyShopifyWebhook(body, sign(body, ""), "")).toBe(false);
  });
});
