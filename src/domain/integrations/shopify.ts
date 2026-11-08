import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Shopify configuration rules and webhook verification. No network access here.
 * Problems name settings only and never repeat their values.
 */

export type ShopifyConfig =
  | { readonly kind: "absent" }
  | { readonly kind: "invalid"; readonly problems: readonly string[] }
  | {
      readonly kind: "complete";
      readonly storeDomain: string;
      readonly accessToken: string;
      readonly apiVersion: string;
      readonly webhookSecret: string | null;
    };

// Requests only ever go to a Shopify-hosted store, so this setting cannot aim them elsewhere.
const STORE_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const API_VERSION = /^\d{4}-(01|04|07|10)$/;

export function parseShopifyConfig(
  env: Readonly<Record<string, string | undefined>>,
): ShopifyConfig {
  const read = (name: string) => env[name]?.trim() || "";
  const storeDomain = read("SHOPIFY_STORE_DOMAIN").toLowerCase();
  const accessToken = read("SHOPIFY_ADMIN_ACCESS_TOKEN");
  const apiVersion = read("SHOPIFY_API_VERSION");
  const webhookSecret = read("SHOPIFY_WEBHOOK_SECRET");
  if (!storeDomain && !accessToken && !apiVersion && !webhookSecret) return { kind: "absent" };

  const problems: string[] = [];
  if (!storeDomain) problems.push("SHOPIFY_STORE_DOMAIN is missing.");
  else if (!STORE_DOMAIN.test(storeDomain)) {
    problems.push("SHOPIFY_STORE_DOMAIN must be a *.myshopify.com domain.");
  }
  if (!accessToken) problems.push("SHOPIFY_ADMIN_ACCESS_TOKEN is missing.");
  if (!apiVersion) problems.push("SHOPIFY_API_VERSION is missing.");
  else if (!API_VERSION.test(apiVersion)) {
    problems.push("SHOPIFY_API_VERSION must look like 2026-10.");
  }
  if (problems.length > 0) return { kind: "invalid", problems };
  return {
    kind: "complete",
    storeDomain,
    accessToken,
    apiVersion,
    webhookSecret: webhookSecret || null,
  };
}

/**
 * Verifies a Shopify webhook: the header must be the base64 HMAC-SHA256 of the exact raw
 * request body. Pass the body before any JSON parsing. The comparison is timing-safe.
 */
export function verifyShopifyWebhook(
  rawBody: string | Buffer,
  hmacHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!secret || !hmacHeader || !/^[A-Za-z0-9+/]+={0,2}$/.test(hmacHeader)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(hmacHeader, "base64");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
