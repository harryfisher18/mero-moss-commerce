import { randomUUID } from "node:crypto";
import {
  addLine,
  type CartLine,
  type CartMutation,
  type PricedCart,
  priceCart,
  removeLine,
  setLineQuantity,
} from "@/domain/commerce/cart";
import { type Database, withTransaction } from "@/server/db/database";
import { SqliteCartRepository } from "@/server/repositories/cart-repository";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";

/**
 * Cart use cases. Every mutation re-reads the variant, product status and stock from the
 * database and validates inside one write transaction, so concurrent requests cannot
 * push a line past available stock. Cart ids are random UUIDs and are the only thing the
 * browser holds.
 */

const CART_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isCartId(value: string | undefined): value is string {
  return value !== undefined && CART_ID.test(value);
}

export interface CartMutationResult {
  readonly cartId: string;
  readonly result: CartMutation;
}

export class CartService {
  private readonly carts: SqliteCartRepository;
  private readonly catalog: SqliteCatalogRepository;

  constructor(
    private readonly db: Database,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly newId: () => string = randomUUID,
  ) {
    this.carts = new SqliteCartRepository(db);
    this.catalog = new SqliteCatalogRepository(db);
  }

  getLines(cartId: string | undefined): CartLine[] {
    return isCartId(cartId) ? this.carts.getLines(cartId) : [];
  }

  getCart(cartId: string | undefined): PricedCart {
    const lines = this.getLines(cartId);
    return priceCart(lines, this.catalog.getCatalogEntries(lines.map((l) => l.variantId)));
  }

  /** Adds to the cart, creating one when `cartId` is missing, malformed or unknown. */
  add(cartId: string | undefined, variantId: string, quantity: number): CartMutationResult {
    return withTransaction(this.db, () => {
      const id = isCartId(cartId) && this.carts.exists(cartId) ? cartId : null;
      const lines = id ? this.carts.getLines(id) : [];
      const entry = this.catalog.getCatalogEntries([variantId]).get(variantId);
      const result = addLine(lines, entry, variantId, quantity);
      if (!result.ok) return { cartId: id ?? "", result };
      const target = id ?? this.newId();
      if (!id) this.carts.create(target, this.now());
      this.carts.saveLines(target, result.lines, this.now());
      return { cartId: target, result };
    });
  }

  setQuantity(cartId: string | undefined, variantId: string, quantity: number): CartMutation {
    return this.mutate(cartId, (lines) =>
      setLineQuantity(
        lines,
        this.catalog.getCatalogEntries([variantId]).get(variantId),
        variantId,
        quantity,
      ),
    );
  }

  remove(cartId: string | undefined, variantId: string): CartMutation {
    return this.mutate(cartId, (lines) => removeLine(lines, variantId));
  }

  private mutate(
    cartId: string | undefined,
    change: (lines: readonly CartLine[]) => CartMutation,
  ): CartMutation {
    if (!isCartId(cartId)) return { ok: false, reason: "line_not_found", maxQuantity: 0 };
    return withTransaction(this.db, () => {
      const result = change(this.carts.getLines(cartId));
      if (result.ok) this.carts.saveLines(cartId, result.lines, this.now());
      return result;
    });
  }
}
