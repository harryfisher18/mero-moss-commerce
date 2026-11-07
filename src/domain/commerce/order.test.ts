import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "./cart";
import type { Product, Variant } from "./catalog";
import { money } from "./money";
import { buildOrderDraft, checkoutDetailsSchema, formatOrderNumber, problemMessage } from "./order";

function entry(
  id: string,
  priceMinor: number,
  inventory: number,
  status: Product["status"] = "active",
): CatalogEntry {
  const variant: Variant = {
    id,
    productId: `prod_${id}`,
    sku: `SKU-${id}`,
    title: id === "mat" ? "Charcoal / Large" : "Default",
    options: {},
    price: money(priceMinor, "USD"),
    compareAtPrice: null,
    inventoryQuantity: inventory,
    position: 0,
  };
  return {
    variant,
    product: {
      id: `prod_${id}`,
      handle: id,
      title: `Product ${id}`,
      categoryHandle: "workspace",
      summary: "",
      description: "",
      materials: "",
      care: "",
      tags: [],
      status,
      featured: false,
      swatch: "#000",
      seoDescription: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      variants: [variant],
    },
  };
}

const valid = {
  email: "  Shopper@Example.com ",
  fullName: "Avery Stone",
  address1: "12 Elm Street",
  address2: "",
  city: "Portland",
  region: "OR",
  postalCode: "97205",
  acknowledgeSimulated: "yes",
};

describe("checkoutDetailsSchema", () => {
  it("accepts and normalizes valid details", () => {
    const parsed = checkoutDetailsSchema.parse(valid);
    expect(parsed.email).toBe("shopper@example.com");
    expect(parsed.region).toBe("OR");
    expect(checkoutDetailsSchema.safeParse({ ...valid, postalCode: "97205-1234" }).success).toBe(
      true,
    );
  });

  it("rejects bad email, ZIP, non-contiguous states and blank required fields", () => {
    const result = checkoutDetailsSchema.safeParse({
      ...valid,
      email: "not-an-email",
      postalCode: "9720",
      region: "HI",
      fullName: "   ",
    });
    expect(result.success).toBe(false);
    const fields = result.success ? [] : result.error.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["email", "postalCode", "region", "fullName"]));
  });

  it("requires the simulated-order acknowledgement", () => {
    const withoutAcknowledgement: Partial<typeof valid> = { ...valid };
    delete withoutAcknowledgement.acknowledgeSimulated;
    const result = checkoutDetailsSchema.safeParse(withoutAcknowledgement);
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error.issues[0]?.message).toBe(
      "Please confirm you understand this is a simulated order.",
    );
  });
});

describe("buildOrderDraft", () => {
  const catalog = new Map([
    ["mat", entry("mat", 5800, 9)],
    ["trivet", entry("trivet", 2900, 2)],
    ["gone", entry("gone", 1000, 0)],
    ["draft", entry("draft", 1000, 5, "draft")],
  ]);

  it("builds snapshot lines and totals for a fulfillable cart", () => {
    const result = buildOrderDraft(
      [
        { variantId: "mat", quantity: 1 },
        { variantId: "trivet", quantity: 2 },
      ],
      catalog,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.lines.map((l) => [l.sku, l.quantity, l.lineTotal.amountMinor])).toEqual([
      ["SKU-mat", 1, 5800],
      ["SKU-trivet", 2, 5800],
    ]);
    expect(result.draft.lines[0]?.variantTitle).toBe("Charcoal / Large");
    expect(result.draft.lines[1]?.variantTitle).toBeNull();
    expect(result.draft.subtotal.amountMinor).toBe(11600);
    expect(result.draft.shipping.amountMinor).toBe(0);
    expect(result.draft.total.amountMinor).toBe(11600);
    expect(result.draft.itemCount).toBe(3);
  });

  it("charges the flat shipping estimate below the free threshold", () => {
    const result = buildOrderDraft([{ variantId: "trivet", quantity: 1 }], catalog);
    expect(result.ok && result.draft.total.amountMinor).toBe(3700);
  });

  it("rejects instead of capping when stock no longer covers the request", () => {
    const result = buildOrderDraft(
      [
        { variantId: "trivet", quantity: 3 },
        { variantId: "gone", quantity: 1 },
        { variantId: "draft", quantity: 1 },
        { variantId: "deleted", quantity: 1 },
        { variantId: "mat", quantity: 1 },
      ],
      catalog,
    );
    expect(result).toEqual({
      ok: false,
      reason: "problems",
      problems: [
        {
          variantId: "trivet",
          productTitle: "Product trivet",
          reason: "insufficient_stock",
          available: 2,
        },
        { variantId: "gone", productTitle: "Product gone", reason: "sold_out", available: 0 },
        { variantId: "draft", productTitle: "Product draft", reason: "unavailable", available: 0 },
        {
          variantId: "deleted",
          productTitle: "An item in your cart",
          reason: "unavailable",
          available: 0,
        },
      ],
    });
  });

  it("rejects an empty cart", () => {
    expect(buildOrderDraft([], catalog)).toEqual({ ok: false, reason: "empty_cart" });
  });
});

describe("helpers", () => {
  it("formats order numbers from a sequence", () => {
    expect(formatOrderNumber(1)).toBe("MM-100001");
    expect(formatOrderNumber(42)).toBe("MM-100042");
    expect(() => formatOrderNumber(0)).toThrow();
  });

  it("explains checkout problems", () => {
    expect(
      problemMessage({
        variantId: "x",
        productTitle: "Cast Iron Trivet",
        reason: "insufficient_stock",
        available: 1,
      }),
    ).toBe("Only 1 of Cast Iron Trivet is available.");
    expect(
      problemMessage({ variantId: "x", productTitle: "Mug", reason: "sold_out", available: 0 }),
    ).toBe("Mug has sold out.");
  });
});
