import type { Order, OrderStatus, OrderStatusEvent, OrderSummary } from "@/domain/commerce/order";
import { canTransition, restocksOnTransition } from "@/domain/commerce/order-status";
import { type Database, withTransaction } from "@/server/db/database";
import { SqliteOrderRepository } from "@/server/repositories/order-repository";

export type TransitionResult =
  | { readonly ok: true; readonly order: Order }
  | { readonly ok: false; readonly reason: "not_found" | "invalid_transition" };

/**
 * Merchant-side order operations. Callers must already have verified a merchant session;
 * this service re-validates the transition against the current status inside a write
 * transaction so concurrent clicks cannot apply an invalid change.
 */
export class MerchantOrderService {
  private readonly orders: SqliteOrderRepository;

  constructor(
    private readonly db: Database,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    this.orders = new SqliteOrderRepository(db);
  }

  list(status?: OrderStatus): OrderSummary[] {
    return this.orders.listSummaries(status);
  }

  get(id: string): { order: Order; events: OrderStatusEvent[] } | null {
    const order = this.orders.getById(id);
    return order ? { order, events: this.orders.getStatusEvents(id) } : null;
  }

  transition(id: string, to: OrderStatus, actor: string): TransitionResult {
    return withTransaction(this.db, (): TransitionResult => {
      const order = this.orders.getById(id);
      if (!order) return { ok: false, reason: "not_found" };
      if (!canTransition(order.status, to)) return { ok: false, reason: "invalid_transition" };

      this.orders.updateStatus(id, to);
      this.orders.addStatusEvent({
        orderId: id,
        fromStatus: order.status,
        toStatus: to,
        actor,
        createdAt: this.now(),
      });
      if (restocksOnTransition(order.status, to)) {
        const restock = this.db.prepare(
          "UPDATE variants SET inventory_quantity = inventory_quantity + ? WHERE id = ?",
        );
        // Variants deleted since the order was placed are simply skipped.
        for (const line of order.lines) restock.run(line.quantity, line.variantId);
      }
      const updated = this.orders.getById(id);
      if (!updated) throw new Error("Order disappeared during transition");
      return { ok: true, order: updated };
    });
  }
}
