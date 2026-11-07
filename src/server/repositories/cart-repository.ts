import { z } from "zod";
import type { CartLine } from "@/domain/commerce/cart";
import type { Database } from "@/server/db/database";

export interface CartRepository {
  exists(cartId: string): boolean;
  create(cartId: string, now: string): void;
  getLines(cartId: string): CartLine[];
  /** Replaces all lines of a cart, preserving the given order. */
  saveLines(cartId: string, lines: readonly CartLine[], now: string): void;
}

const lineRow = z.object({ variant_id: z.string(), quantity: z.number().int().positive() });

export class SqliteCartRepository implements CartRepository {
  constructor(private readonly db: Database) {}

  exists(cartId: string): boolean {
    return this.db.prepare("SELECT 1 AS found FROM carts WHERE id = ?").get(cartId) !== undefined;
  }

  create(cartId: string, now: string): void {
    this.db
      .prepare("INSERT INTO carts (id, created_at, updated_at) VALUES (?, ?, ?)")
      .run(cartId, now, now);
  }

  getLines(cartId: string): CartLine[] {
    return this.db
      .prepare("SELECT variant_id, quantity FROM cart_lines WHERE cart_id = ? ORDER BY position")
      .all(cartId)
      .map((row) => {
        const parsed = lineRow.parse(row);
        return { variantId: parsed.variant_id, quantity: parsed.quantity };
      });
  }

  saveLines(cartId: string, lines: readonly CartLine[], now: string): void {
    this.db.prepare("DELETE FROM cart_lines WHERE cart_id = ?").run(cartId);
    const insert = this.db.prepare(
      "INSERT INTO cart_lines (cart_id, variant_id, quantity, position) VALUES (?, ?, ?, ?)",
    );
    lines.forEach((line, index) => insert.run(cartId, line.variantId, line.quantity, index));
    this.db.prepare("UPDATE carts SET updated_at = ? WHERE id = ?").run(now, cartId);
  }
}
