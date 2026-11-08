import type { Order, OrderStatus, OrderStatusEvent, OrderSummary } from "@/domain/commerce/order";
import { canTransition, restocksOnTransition } from "@/domain/commerce/order-status";
import {
  type ReviewClearance,
  reviewBlocksTransition,
  type ReviewState,
  reviewState,
} from "@/domain/commerce/order-review";
import { type Database, withTransaction } from "@/server/db/database";
import { SqliteOrderRepository } from "@/server/repositories/order-repository";
import { z } from "zod";

export type TransitionResult =
  | { readonly ok: true; readonly order: Order }
  | { readonly ok: false; readonly reason: "not_found" | "invalid_transition" | "needs_review" };

export type ClearReviewResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: "not_found" | "not_held" };

const tagRow = z.object({ tag: z.string() });
const clearanceRow = z.object({ cleared_by: z.string(), cleared_at: z.string() });

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

  /** Orders waiting for a person to check them. */
  listHeldForReview(): OrderSummary[] {
    return this.orders.listHeldForReview();
  }

  tags(id: string): string[] {
    return this.db
      .prepare("SELECT tag FROM order_tags WHERE order_id = ? ORDER BY tag")
      .all(id)
      .map((raw) => tagRow.parse(raw).tag);
  }

  review(id: string): ReviewState {
    const raw = this.db
      .prepare("SELECT cleared_by, cleared_at FROM order_reviews WHERE order_id = ?")
      .get(id);
    let clearance: ReviewClearance | null = null;
    if (raw) {
      const row = clearanceRow.parse(raw);
      clearance = { clearedBy: row.cleared_by, clearedAt: row.cleared_at };
    }
    return reviewState(this.tags(id), clearance);
  }

  /** Releases a held order, recording who checked it. */
  clearReview(id: string, actor: string): ClearReviewResult {
    return withTransaction(this.db, (): ClearReviewResult => {
      const order = this.orders.getById(id);
      if (!order) return { ok: false, reason: "not_found" };
      if (this.review(id).kind !== "held" || order.status !== "placed") {
        return { ok: false, reason: "not_held" };
      }
      this.db
        .prepare("INSERT INTO order_reviews (order_id, cleared_by, cleared_at) VALUES (?, ?, ?)")
        .run(id, actor, this.now());
      return { ok: true };
    });
  }

  transition(id: string, to: OrderStatus, actor: string): TransitionResult {
    return withTransaction(this.db, (): TransitionResult => {
      const order = this.orders.getById(id);
      if (!order) return { ok: false, reason: "not_found" };
      if (!canTransition(order.status, to)) return { ok: false, reason: "invalid_transition" };
      if (reviewBlocksTransition(this.review(id), to)) return { ok: false, reason: "needs_review" };

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
