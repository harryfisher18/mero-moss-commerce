import { describe, expect, it } from "vitest";
import { canTransition, allowedTransitions, restocksOnTransition } from "../commerce/order-status";
import {
  emailsMatch,
  hashPassword,
  isLoginLocked,
  LOGIN_RATE_LIMIT,
  verifyPassword,
} from "./credentials";
import { safeAdminPath } from "./navigation";

describe("password hashing", () => {
  it("verifies the right password and rejects others", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(stored.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(verifyPassword("correct horse battery stapler", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
  });

  it("uses a random salt per hash", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("rejects malformed or abusive stored hashes instead of throwing", () => {
    expect(verifyPassword("x", "plaintext")).toBe(false);
    expect(verifyPassword("x", "scrypt$abc$8$1$c2FsdA$aGFzaA")).toBe(false);
    expect(verifyPassword("x", "scrypt$1073741824$8$1$c2FsdA$aGFzaA")).toBe(false);
    expect(verifyPassword("x", "scrypt$16384$8$1$c2FsdA$dG9vLXNob3J0")).toBe(false);
  });
});

describe("emailsMatch", () => {
  it("ignores case and surrounding whitespace", () => {
    expect(emailsMatch("  Merchant@Example.COM ", "merchant@example.com")).toBe(true);
    expect(emailsMatch("other@example.com", "merchant@example.com")).toBe(false);
  });
});

describe("login rate limit", () => {
  it("locks after the configured number of recent failures", () => {
    expect(isLoginLocked(LOGIN_RATE_LIMIT.maxFailures - 1)).toBe(false);
    expect(isLoginLocked(LOGIN_RATE_LIMIT.maxFailures)).toBe(true);
  });
});

describe("order status transitions", () => {
  it("allows only the documented lifecycle", () => {
    expect(allowedTransitions("placed")).toEqual(["processing", "cancelled"]);
    expect(allowedTransitions("processing")).toEqual(["fulfilled", "cancelled"]);
    expect(allowedTransitions("fulfilled")).toEqual([]);
    expect(allowedTransitions("cancelled")).toEqual([]);
    expect(canTransition("placed", "fulfilled")).toBe(false);
    expect(canTransition("fulfilled", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "placed")).toBe(false);
    expect(canTransition("placed", "placed")).toBe(false);
  });

  it("restocks only when cancelling an order that has not shipped", () => {
    expect(restocksOnTransition("placed", "cancelled")).toBe(true);
    expect(restocksOnTransition("processing", "cancelled")).toBe(true);
    expect(restocksOnTransition("processing", "fulfilled")).toBe(false);
  });
});

describe("safeAdminPath", () => {
  it("keeps console paths and rejects everything else", () => {
    expect(safeAdminPath("/admin/orders/abc-123")).toBe("/admin/orders/abc-123");
    for (const bad of [
      "https://evil.example/admin/orders",
      "//evil.example",
      "/admin//evil.example",
      "/cart",
      "/admin/login",
      "/admin/orders?next=https://evil.example",
      undefined,
      42,
    ]) {
      expect(safeAdminPath(bad)).toBe("/admin/orders");
    }
  });
});
