import { randomUUID } from "node:crypto";
import {
  buildOrderDraft,
  type CheckoutDetails,
  type CheckoutProblem,
  formatOrderNumber,
  type Order,
} from "@/domain/commerce/order";
import { isCartId } from "@/server/cart-service";
import { type Database, withTransaction } from "@/server/db/database";
import { SqliteCartRepository } from "@/server/repositories/cart-repository";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";
import { SqliteOrderRepository } from "@/server/repositories/order-repository";

export type PlaceOrderResult =
  | { readonly ok: true; readonly order: Order; readonly confirmationToken: string }
  | { readonly ok: false; readonly reason: "empty_cart" }
  | { readonly ok: false; readonly reason: "problems"; readonly problems: CheckoutProblem[] };

/** Thrown inside the transaction to force a rollback when a guarded decrement fails. */
class StockChangedError extends Error {
  constructor(readonly variantId: string) {
    super(`Stock changed for ${variantId} during checkout`);
  }
}

/**
 * Places SIMULATED orders. Everything happens in one write transaction:
 * re-read the cart and live stock, validate, insert the order with price snapshots,
 * decrement inventory with a guarded update, and delete the cart. Any failure rolls
 * back the whole order, so stock can never go negative or be sold twice.
 */
export class OrderService {
  private readonly carts: SqliteCartRepository;
  private readonly catalog: SqliteCatalogRepository;
  private readonly orders: SqliteOrderRepository;

  constructor(
    private readonly db: Database,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = randomUUID,
  ) {
    this.carts = new SqliteCartRepository(db);
    this.catalog = new SqliteCatalogRepository(db);
    this.orders = new SqliteOrderRepository(db);
  }

  placeOrder(cartId: string | undefined, details: CheckoutDetails): PlaceOrderResult {
    if (!isCartId(cartId)) return { ok: false, reason: "empty_cart" };
    try {
      return withTransaction(this.db, (): PlaceOrderResult => {
        const lines = this.carts.getLines(cartId);
        const result = buildOrderDraft(
          lines,
          this.catalog.getCatalogEntries(lines.map((line) => line.variantId)),
        );
        if (!result.ok) return result;

        const sequence = this.orders.nextSequence();
        const id = this.newId();
        const confirmationToken = this.newId();
        this.orders.insert({
          id,
          sequence,
          orderNumber: formatOrderNumber(sequence),
          email: details.email,
          shippingAddress: {
            fullName: details.fullName,
            address1: details.address1,
            address2: details.address2,
            city: details.city,
            region: details.region,
            postalCode: details.postalCode,
            country: "US",
          },
          draft: result.draft,
          confirmationToken,
          createdAt: this.now(),
        });
        for (const line of result.draft.lines) {
          if (!this.catalog.decrementInventory(line.variantId, line.quantity)) {
            throw new StockChangedError(line.variantId);
          }
        }
        this.orders.addStatusEvent({
          orderId: id,
          fromStatus: null,
          toStatus: "placed",
          actor: "Shopper (storefront checkout)",
          createdAt: this.now(),
        });
        this.carts.delete(cartId);

        const order = this.orders.getById(id);
        if (!order) throw new Error("Order was not persisted");
        return { ok: true, order, confirmationToken };
      });
    } catch (error) {
      if (error instanceof StockChangedError) {
        // Defensive: validation and decrement share a transaction, so this indicates a
        // concurrent writer outside the transaction. Report it like any stock problem.
        return {
          ok: false,
          reason: "problems",
          problems: [
            {
              variantId: error.variantId,
              productTitle: "An item in your cart",
              reason: "insufficient_stock",
              available: 0,
            },
          ],
        };
      }
      throw error;
    }
  }

  getOrderByConfirmationToken(token: string | undefined): Order | null {
    if (!token || !isCartId(token)) return null;
    return this.orders.getByConfirmationToken(token);
  }
}
