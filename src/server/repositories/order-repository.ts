import { z } from "zod";
import { money, SUPPORTED_CURRENCIES } from "@/domain/commerce/money";
import {
  ORDER_STATUSES,
  type Order,
  type OrderDraft,
  type OrderStatus,
  type OrderStatusEvent,
  type OrderSummary,
  SHIPPING_REGIONS,
  type ShippingAddress,
} from "@/domain/commerce/order";
import type { Database } from "@/server/db/database";

export interface NewOrder {
  readonly id: string;
  readonly sequence: number;
  readonly orderNumber: string;
  readonly email: string;
  readonly shippingAddress: ShippingAddress;
  readonly draft: OrderDraft;
  readonly confirmationToken: string;
  readonly createdAt: string;
}

export interface OrderRepository {
  nextSequence(): number;
  insert(order: NewOrder): void;
  getByConfirmationToken(token: string): Order | null;
  getById(id: string): Order | null;
  listSummaries(status?: OrderStatus): OrderSummary[];
  updateStatus(id: string, status: OrderStatus): void;
  addStatusEvent(event: OrderStatusEvent & { readonly orderId: string }): void;
  getStatusEvents(orderId: string): OrderStatusEvent[];
}

const REGION_CODES = Object.keys(SHIPPING_REGIONS) as [
  keyof typeof SHIPPING_REGIONS,
  ...(keyof typeof SHIPPING_REGIONS)[],
];

const orderRow = z.object({
  id: z.string(),
  order_number: z.string(),
  status: z.enum(ORDER_STATUSES),
  is_simulated: z.literal(1),
  email: z.string(),
  full_name: z.string(),
  address1: z.string(),
  address2: z.string(),
  city: z.string(),
  region: z.enum(REGION_CODES),
  postal_code: z.string(),
  country: z.literal("US"),
  currency: z.enum(SUPPORTED_CURRENCIES),
  subtotal_minor: z.number().int(),
  shipping_minor: z.number().int(),
  total_minor: z.number().int(),
  created_at: z.string(),
});

const summaryRow = z.object({
  id: z.string(),
  order_number: z.string(),
  status: z.enum(ORDER_STATUSES),
  full_name: z.string(),
  email: z.string(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  total_minor: z.number().int(),
  item_count: z.number().int(),
  created_at: z.string(),
});

const eventRow = z.object({
  from_status: z.enum(ORDER_STATUSES).nullable(),
  to_status: z.enum(ORDER_STATUSES),
  actor: z.string(),
  created_at: z.string(),
});

const lineRow = z.object({
  variant_id: z.string(),
  product_id: z.string(),
  sku: z.string(),
  product_title: z.string(),
  variant_title: z.string().nullable(),
  unit_price_minor: z.number().int(),
  quantity: z.number().int(),
  line_total_minor: z.number().int(),
});

export class SqliteOrderRepository implements OrderRepository {
  constructor(private readonly db: Database) {}

  /** Must be called inside the same write transaction as `insert`. */
  nextSequence(): number {
    const row = this.db.prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM orders").get();
    return Number(row?.next ?? 1);
  }

  insert(order: NewOrder): void {
    const { draft, shippingAddress: address } = order;
    this.db
      .prepare(
        `INSERT INTO orders (id, sequence, order_number, status, is_simulated, email, full_name,
           address1, address2, city, region, postal_code, country, currency, subtotal_minor,
           shipping_minor, total_minor, confirmation_token, created_at)
         VALUES (?, ?, ?, 'placed', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        order.id,
        order.sequence,
        order.orderNumber,
        order.email,
        address.fullName,
        address.address1,
        address.address2,
        address.city,
        address.region,
        address.postalCode,
        address.country,
        draft.currency,
        draft.subtotal.amountMinor,
        draft.shipping.amountMinor,
        draft.total.amountMinor,
        order.confirmationToken,
        order.createdAt,
      );
    const insertLine = this.db.prepare(
      `INSERT INTO order_lines (order_id, position, variant_id, product_id, sku, product_title,
         variant_title, unit_price_minor, quantity, line_total_minor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    draft.lines.forEach((line, index) =>
      insertLine.run(
        order.id,
        index,
        line.variantId,
        line.productId,
        line.sku,
        line.productTitle,
        line.variantTitle,
        line.unitPrice.amountMinor,
        line.quantity,
        line.lineTotal.amountMinor,
      ),
    );
  }

  getByConfirmationToken(token: string): Order | null {
    const row = this.db.prepare("SELECT * FROM orders WHERE confirmation_token = ?").get(token);
    return row ? this.toOrder(orderRow.parse(row)) : null;
  }

  getById(id: string): Order | null {
    const row = this.db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    return row ? this.toOrder(orderRow.parse(row)) : null;
  }

  listSummaries(status?: OrderStatus): OrderSummary[] {
    return status ? this.summaries("WHERE o.status = ?", [status]) : this.summaries("", []);
  }

  /** Placed orders that automation flagged and nobody has cleared yet. */
  listHeldForReview(): OrderSummary[] {
    return this.summaries(
      `WHERE o.status = 'placed'
         AND EXISTS (SELECT 1 FROM order_tags t WHERE t.order_id = o.id AND t.tag LIKE 'review:%')
         AND NOT EXISTS (SELECT 1 FROM order_reviews r WHERE r.order_id = o.id)`,
      [],
    );
  }

  private summaries(where: string, params: readonly string[]): OrderSummary[] {
    const sql = `
      SELECT o.id, o.order_number, o.status, o.full_name, o.email, o.currency, o.total_minor,
             o.created_at, COALESCE(SUM(l.quantity), 0) AS item_count
      FROM orders o LEFT JOIN order_lines l ON l.order_id = o.id
      ${where}
      GROUP BY o.id
      ORDER BY o.sequence DESC
      LIMIT 200`;
    const rows = this.db.prepare(sql).all(...params);
    return rows.map((raw) => {
      const row = summaryRow.parse(raw);
      return {
        id: row.id,
        orderNumber: row.order_number,
        status: row.status,
        customerName: row.full_name,
        email: row.email,
        itemCount: row.item_count,
        total: money(row.total_minor, row.currency),
        createdAt: row.created_at,
      };
    });
  }

  updateStatus(id: string, status: OrderStatus): void {
    this.db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
  }

  addStatusEvent(event: OrderStatusEvent & { readonly orderId: string }): void {
    this.db
      .prepare(
        "INSERT INTO order_status_events (order_id, from_status, to_status, actor, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(event.orderId, event.fromStatus, event.toStatus, event.actor, event.createdAt);
  }

  getStatusEvents(orderId: string): OrderStatusEvent[] {
    return this.db
      .prepare(
        "SELECT from_status, to_status, actor, created_at FROM order_status_events WHERE order_id = ? ORDER BY id",
      )
      .all(orderId)
      .map((raw) => {
        const row = eventRow.parse(raw);
        return {
          fromStatus: row.from_status,
          toStatus: row.to_status,
          actor: row.actor,
          createdAt: row.created_at,
        };
      });
  }

  private toOrder(row: z.infer<typeof orderRow>): Order {
    const currency = row.currency;
    const lines = this.db
      .prepare("SELECT * FROM order_lines WHERE order_id = ? ORDER BY position")
      .all(row.id)
      .map((raw) => {
        const line = lineRow.parse(raw);
        return {
          variantId: line.variant_id,
          productId: line.product_id,
          sku: line.sku,
          productTitle: line.product_title,
          variantTitle: line.variant_title,
          unitPrice: money(line.unit_price_minor, currency),
          quantity: line.quantity,
          lineTotal: money(line.line_total_minor, currency),
        };
      });
    return {
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      isSimulated: true,
      email: row.email,
      shippingAddress: {
        fullName: row.full_name,
        address1: row.address1,
        address2: row.address2,
        city: row.city,
        region: row.region,
        postalCode: row.postal_code,
        country: row.country,
      },
      currency,
      lines,
      subtotal: money(row.subtotal_minor, currency),
      shipping: money(row.shipping_minor, currency),
      total: money(row.total_minor, currency),
      createdAt: row.created_at,
    };
  }
}
