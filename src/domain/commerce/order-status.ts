import type { OrderStatus } from "./order";

/**
 * Merchant order lifecycle for simulated orders. Pure rules only.
 *
 *   placed ──► processing ──► fulfilled
 *     │            │
 *     └──► cancelled ◄┘
 *
 * Fulfilled and cancelled are terminal. Cancelling returns the units to stock.
 */
const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  placed: ["processing", "cancelled"],
  processing: ["fulfilled", "cancelled"],
  fulfilled: [],
  cancelled: [],
};

export const STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  placed: "Placed",
  processing: "Processing",
  fulfilled: "Fulfilled (simulated)",
  cancelled: "Cancelled",
};

/** Verb shown on the merchant's action button for a target status. */
export const STATUS_ACTION_LABELS: Readonly<Record<OrderStatus, string>> = {
  placed: "Mark as placed",
  processing: "Start processing",
  fulfilled: "Mark fulfilled (simulated)",
  cancelled: "Cancel order",
};

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Cancelling an order that has not shipped puts its units back into stock. */
export function restocksOnTransition(from: OrderStatus, to: OrderStatus): boolean {
  return to === "cancelled" && (from === "placed" || from === "processing");
}
