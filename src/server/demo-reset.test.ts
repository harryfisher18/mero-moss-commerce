import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkDemoReset, RESET_CONFIRMATION, settingsGroups } from "@/domain/merchant/settings";
import { CartService } from "@/server/cart-service";
import { type Database, openDatabase } from "@/server/db/database";
import { seedDatabase } from "@/server/db/seed";
import { resetDemoStore } from "@/server/demo-reset";
import { MerchantAuthService } from "@/server/merchant-auth-service";
import { DEMO_MERCHANT_EMAIL, DEMO_MERCHANT_PASSWORD } from "@/server/merchant-config";
import { OrderService } from "@/server/order-service";

let db: Database;

const count = (table: string) => Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n);

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
});

afterEach(() => db.close());

describe("checkDemoReset", () => {
  it("is refused when real merchant credentials are configured, whatever is typed", () => {
    expect(checkDemoReset({ isDemo: false, confirmation: RESET_CONFIRMATION })).toEqual({
      ok: false,
      reason: "not_demo",
    });
  });

  it("needs the exact phrase, ignoring case and surrounding spaces", () => {
    expect(checkDemoReset({ isDemo: true, confirmation: "reset" })).toEqual({
      ok: false,
      reason: "not_confirmed",
    });
    expect(checkDemoReset({ isDemo: true, confirmation: "  Reset Demo Store " })).toEqual({
      ok: true,
    });
  });
});

describe("settingsGroups", () => {
  it("reports only whether each setting is set, never its value", () => {
    const groups = settingsGroups({
      MERCHANT_EMAIL: "owner@example.com",
      ANTHROPIC_API_KEY: "sk-secret-value",
      SHOPIFY_STORE_DOMAIN: "  ",
    });
    const rows = groups.flatMap((group) => group.rows);
    expect(rows.find((row) => row.name === "MERCHANT_EMAIL")?.state).toBe("Set");
    expect(rows.find((row) => row.name === "ANTHROPIC_API_KEY")?.state).toBe("Set");
    expect(rows.find((row) => row.name === "SHOPIFY_STORE_DOMAIN")?.state).toBe("Not set");
    expect(JSON.stringify(groups)).not.toMatch(/owner@example\.com|sk-secret-value/);
  });
});

describe("resetDemoStore", () => {
  it("removes orders, carts and records, restores the catalog, and keeps sessions", () => {
    const products = count("products");
    const variants = count("variants");
    const auth = new MerchantAuthService(db);
    const login = auth.login(DEMO_MERCHANT_EMAIL, DEMO_MERCHANT_PASSWORD);
    if (!login.ok) throw new Error("login failed");

    const carts = new CartService(db);
    const { cartId } = carts.add(undefined, "var_mm-ws-fdm-chr-l", 2);
    const placed = new OrderService(db).placeOrder(cartId, {
      email: "avery@example.com",
      fullName: "Avery Stone",
      address1: "12 Elm Street",
      address2: "",
      city: "Portland",
      region: "OR",
      postalCode: "97205",
      acknowledgeSimulated: "yes",
    });
    expect(placed.ok).toBe(true);
    db.prepare("UPDATE products SET title = 'Edited' WHERE id = 'prod_felt-desk-mat'").run();
    expect(count("orders")).toBe(1);

    const summary = resetDemoStore(db);
    expect(summary.rowsRemoved).toBeGreaterThan(0);
    for (const table of ["orders", "order_lines", "outbox_events", "carts", "analytics_events"]) {
      expect({ table, rows: count(table) }).toEqual({ table, rows: 0 });
    }
    expect(count("products")).toBe(products);
    expect(count("variants")).toBe(variants);
    expect(
      db.prepare("SELECT title FROM products WHERE id = 'prod_felt-desk-mat'").get()?.title,
    ).toBe("Felt Desk Mat");
    expect(
      db
        .prepare("SELECT inventory_quantity AS q FROM variants WHERE id = 'var_mm-ws-fdm-chr-l'")
        .get()?.q,
    ).toBe(9);
    // The merchant who reset the store is still signed in.
    expect(auth.verify(login.token)).not.toBeNull();
    // The migration record is kept, so the schema is not rebuilt.
    expect(count("schema_migrations")).toBeGreaterThan(0);
  });
});
