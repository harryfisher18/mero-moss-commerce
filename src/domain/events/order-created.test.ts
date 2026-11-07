import { describe, expect, it } from "vitest";
import { money } from "@/domain/commerce/money";
import type { Order } from "@/domain/commerce/order";
import {
  notificationPreviews,
  OPERATIONS_RECIPIENT,
  orderCreatedPayload,
  orderCreatedPayloadSchema,
  redactEmail,
  redactName,
  redactPayload,
  redactRecipient,
  routeOrder,
} from "./order-created";

const usd = (amountMinor: number) => money(amountMinor, "USD");

function order(
  overrides: { region?: Order["shippingAddress"]["region"]; quantity?: number; unit?: number } = {},
): Order {
  const quantity = overrides.quantity ?? 2;
  const unit = overrides.unit ?? 5800;
  return {
    id: "00000000-0000-4000-8000-000000000001",
    orderNumber: "MM-100001",
    status: "placed",
    isSimulated: true,
    email: "avery@example.com",
    shippingAddress: {
      fullName: "Avery Stone",
      address1: "12 Elm Street",
      address2: "",
      city: "Portland",
      region: overrides.region ?? "OR",
      postalCode: "97205",
      country: "US",
    },
    currency: "USD",
    lines: [
      {
        variantId: "var_mat",
        productId: "prod_mat",
        sku: "MM-WS-FDM-CHR-L",
        productTitle: "Felt Desk Mat",
        variantTitle: "Charcoal / Large",
        unitPrice: usd(unit),
        quantity,
        lineTotal: usd(unit * quantity),
      },
    ],
    subtotal: usd(unit * quantity),
    shipping: usd(0),
    total: usd(unit * quantity),
    createdAt: "2026-11-08T12:00:00.000Z",
  };
}

describe("order.created payload", () => {
  it("captures what the worker needs and validates against the schema", () => {
    const payload = orderCreatedPayload(order());
    expect(orderCreatedPayloadSchema.parse(payload)).toEqual(payload);
    expect(payload).toMatchObject({
      orderNumber: "MM-100001",
      simulated: true,
      shipTo: { region: "OR", postalCode: "97205" },
      itemCount: 2,
      totalMinor: 11_600,
    });
    // The street address never enters the event.
    expect(JSON.stringify(payload)).not.toContain("Elm Street");
  });

  it("rejects malformed payloads", () => {
    const payload = orderCreatedPayload(order());
    expect(orderCreatedPayloadSchema.safeParse({ ...payload, lines: [] }).success).toBe(false);
    expect(orderCreatedPayloadSchema.safeParse({ ...payload, simulated: false }).success).toBe(
      false,
    );
    expect(orderCreatedPayloadSchema.safeParse({ ...payload, totalMinor: 1.5 }).success).toBe(
      false,
    );
  });
});

describe("routeOrder", () => {
  it("routes by ship zone with no review for a typical order", () => {
    expect(routeOrder(orderCreatedPayload(order({ region: "OR" })))).toEqual({
      zone: "west",
      tags: ["route:west"],
      reviewReasons: [],
      needsReview: false,
    });
    expect(routeOrder(orderCreatedPayload(order({ region: "TX" }))).zone).toBe("central");
    expect(routeOrder(orderCreatedPayload(order({ region: "DC" }))).zone).toBe("east");
  });

  it("holds high-value orders for review at the threshold, not below it", () => {
    expect(routeOrder(orderCreatedPayload(order({ quantity: 1, unit: 49_999 }))).needsReview).toBe(
      false,
    );
    const routing = routeOrder(orderCreatedPayload(order({ quantity: 1, unit: 50_000 })));
    expect(routing.tags).toEqual(["route:west", "review:high-value"]);
    expect(routing.reviewReasons[0]).toContain("$500.00");
  });

  it("holds bulk quantities for review", () => {
    expect(routeOrder(orderCreatedPayload(order({ quantity: 4, unit: 100 }))).needsReview).toBe(
      false,
    );
    const routing = routeOrder(orderCreatedPayload(order({ quantity: 5, unit: 100 })));
    expect(routing.tags).toEqual(["route:west", "review:bulk-quantity"]);
    expect(routing.reviewReasons[0]).toContain("5 units of Felt Desk Mat");
  });
});

describe("notificationPreviews", () => {
  it("previews only the customer confirmation when no review is needed", () => {
    const payload = orderCreatedPayload(order());
    const previews = notificationPreviews(payload, routeOrder(payload));
    expect(previews.map((p) => p.kind)).toEqual(["customer_confirmation"]);
    const [confirmation] = previews;
    expect(confirmation?.recipient).toBe("avery@example.com");
    expect(confirmation?.subject).toBe("Your Mero & Moss order MM-100001 is confirmed");
    expect(confirmation?.body).toContain("- 2 × Felt Desk Mat (Charcoal / Large): $116.00");
    expect(confirmation?.body).toContain("Shipping: Free");
    expect(confirmation?.body).toContain("No payment was taken.");
  });

  it("adds an internal review request with the reasons when held", () => {
    const payload = orderCreatedPayload(order({ quantity: 6, unit: 10_000 }));
    const previews = notificationPreviews(payload, routeOrder(payload));
    expect(previews.map((p) => p.kind)).toEqual(["customer_confirmation", "merchant_review"]);
    const review = previews[1];
    expect(review?.recipient).toBe(OPERATIONS_RECIPIENT);
    expect(review?.body).toContain("$600.00");
    expect(review?.body).toContain("6 units of Felt Desk Mat");
    expect(review?.body).toContain("West ship zone");
  });
});

describe("redaction", () => {
  it("masks emails, names and postal codes", () => {
    expect(redactEmail("avery@example.com")).toBe("a***@example.com");
    expect(redactEmail("not-an-email")).toBe("***");
    expect(redactName("avery  stone")).toBe("A. S.");
    expect(redactRecipient(OPERATIONS_RECIPIENT)).toBe(OPERATIONS_RECIPIENT);

    const redacted = redactPayload(orderCreatedPayload(order()));
    expect(redacted.customer).toEqual({ email: "a***@example.com", name: "A. S." });
    expect(redacted.shipTo).toEqual({ region: "OR", postalCode: "972**" });
    const text = JSON.stringify(redacted);
    expect(text).not.toContain("avery@");
    expect(text).not.toContain("Stone");
    expect(text).not.toContain("97205");
  });
});
