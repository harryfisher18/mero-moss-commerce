import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { verifyShopifyWebhook } from "@/domain/integrations/shopify";

const SECRET = "sample-webhook-secret";

/** Produced independently with the openssl command in docs/samples/webhooks/README.md. */
const OPENSSL_SIGNATURES = {
  "orders-create.json": "8NiD07iK8boBN++cs1IFY2Fk9uy6j/jDvdxAELQzny0=",
  "products-update.json": "3GEXDVClOUqJztPEt/h/m83a6X2jRa3iyyh2yXEO46E=",
};

const SAMPLES = Object.entries(OPENSSL_SIGNATURES);
const read = (name: string) => readFileSync(`docs/samples/webhooks/${name}`);

describe("sample webhook events", () => {
  it.each(SAMPLES)("%s verifies with its openssl signature", (name, signature) => {
    expect(verifyShopifyWebhook(read(name), signature, SECRET)).toBe(true);
  });

  it.each(SAMPLES)("%s fails verification once altered", (name, signature) => {
    const altered = Buffer.from(read(name).toString("utf8").replace("58.00", "0.01"));
    expect(altered.equals(read(name))).toBe(false);
    expect(verifyShopifyWebhook(altered, signature, SECRET)).toBe(false);
    // A forger who re-signs with the wrong secret fails too.
    const forged = createHmac("sha256", "wrong-secret").update(altered).digest("base64");
    expect(verifyShopifyWebhook(altered, forged, SECRET)).toBe(false);
  });

  it.each(SAMPLES)("%s is valid JSON with only synthetic contact details", (name) => {
    const text = read(name).toString("utf8");
    expect(() => JSON.parse(text) as unknown).not.toThrow();
    const emails = text.match(/[^\s"]+@[^\s"]+/g) ?? [];
    expect(emails.every((email) => email.endsWith("@example.com"))).toBe(true);
  });
});

describe("DEPLOYMENT.md", () => {
  it("documents every setting in .env.example", () => {
    const settings = [...readFileSync(".env.example", "utf8").matchAll(/^# ?([A-Z_]+)=/gm)].map(
      (match) => match[1] ?? "",
    );
    expect(settings.length).toBeGreaterThan(5);
    const notes = readFileSync("DEPLOYMENT.md", "utf8");
    expect(settings.filter((name) => !notes.includes(`\`${name}\``))).toEqual([]);
  });
});
