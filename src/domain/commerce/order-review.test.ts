import { describe, expect, it } from "vitest";
import { money } from "./money";
import type { OrderDraftLine, ShippingAddress } from "./order";
import { fulfillmentPreview, reviewBlocksTransition, reviewState } from "./order-review";

const CLEARANCE = { clearedBy: "owner@example.com", clearedAt: "2026-11-08T12:00:00.000Z" };
const ROUTE = "route:west";
const REVIEW = "review:bulk-quantity";

const line: OrderDraftLine = {
  variantId: "v",
  productId: "p",
  sku: "MM-1",
  productTitle: "Felt Desk Mat",
  variantTitle: "Oat",
  unitPrice: money(1000, "USD"),
  quantity: 3,
  lineTotal: money(3000, "USD"),
};
const address: ShippingAddress = {
  fullName: "Avery Stone",
  address1: "12 Elm Street",
  address2: "",
  city: "Portland",
  region: "OR",
  postalCode: "97205",
  country: "US",
};
const order = (status: "placed" | "processing" | "fulfilled" | "cancelled") => ({
  status,
  lines: [line, { ...line, sku: "MM-2", variantTitle: null, quantity: 2 }],
  shippingAddress: address,
});

describe("reviewState", () => {
  it("needs no review without review tags", () => {
    expect(reviewState([ROUTE], null)).toEqual({ kind: "not_needed" });
    expect(reviewState([ROUTE], CLEARANCE)).toEqual({ kind: "not_needed" });
  });

  it("holds a tagged order until it is cleared", () => {
    expect(reviewState([ROUTE, REVIEW], null)).toEqual({ kind: "held", tags: [REVIEW] });
    expect(reviewState([ROUTE, REVIEW], CLEARANCE)).toEqual({
      kind: "cleared",
      tags: [REVIEW],
      clearance: CLEARANCE,
    });
  });
});

describe("reviewBlocksTransition", () => {
  const held = reviewState([REVIEW], null);

  it("blocks progress on a held order but always allows cancelling", () => {
    expect(reviewBlocksTransition(held, "processing")).toBe(true);
    expect(reviewBlocksTransition(held, "fulfilled")).toBe(true);
    expect(reviewBlocksTransition(held, "cancelled")).toBe(false);
  });

  it("blocks nothing once cleared or when no review is needed", () => {
    expect(reviewBlocksTransition(reviewState([REVIEW], CLEARANCE), "processing")).toBe(false);
    expect(reviewBlocksTransition(reviewState([ROUTE], null), "processing")).toBe(false);
  });
});

describe("fulfillmentPreview", () => {
  const notNeeded = reviewState([ROUTE], null);
  const held = reviewState([ROUTE, REVIEW], null);

  it("builds the pick list and destination from the order, with no personal details", () => {
    const preview = fulfillmentPreview(order("placed"), [ROUTE], notNeeded);
    expect(preview).toEqual({
      readiness: "ready",
      routeTag: ROUTE,
      destination: "Portland, OR",
      pickList: [
        { sku: "MM-1", title: "Felt Desk Mat", variantTitle: "Oat", quantity: 3 },
        { sku: "MM-2", title: "Felt Desk Mat", variantTitle: null, quantity: 2 },
      ],
      totalUnits: 5,
    });
    expect(JSON.stringify(preview)).not.toMatch(/Avery|Elm Street|97205/);
  });

  it("reports readiness from status, routing and review", () => {
    const readinessOf = (...args: Parameters<typeof fulfillmentPreview>) =>
      fulfillmentPreview(...args)?.readiness;
    expect(readinessOf(order("placed"), [], reviewState([], null))).toBe("awaiting_routing");
    expect(readinessOf(order("placed"), [ROUTE, REVIEW], held)).toBe("held");
    expect(readinessOf(order("placed"), [ROUTE, REVIEW], reviewState([REVIEW], CLEARANCE))).toBe(
      "ready",
    );
    expect(readinessOf(order("processing"), [ROUTE], notNeeded)).toBe("in_progress");
    expect(readinessOf(order("fulfilled"), [ROUTE], notNeeded)).toBe("done");
  });

  it("has nothing to prepare for a cancelled order", () => {
    expect(fulfillmentPreview(order("cancelled"), [ROUTE], notNeeded)).toBeNull();
  });
});
