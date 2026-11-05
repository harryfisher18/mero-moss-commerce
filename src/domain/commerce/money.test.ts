import { describe, expect, it } from "vitest";
import {
  addMoney,
  formatMoney,
  isCurrencyCode,
  money,
  MoneyError,
  multiplyMoney,
  subtractMoney,
  sumMoney,
} from "./money";

describe("money", () => {
  it("rejects non-integer minor units", () => {
    expect(() => money(12.5, "USD")).toThrow(MoneyError);
    expect(() => money(Number.NaN, "USD")).toThrow(MoneyError);
  });

  it("adds, subtracts and multiplies in minor units without float drift", () => {
    const a = money(1999, "USD");
    const b = money(1, "USD");
    expect(addMoney(a, b)).toEqual({ amountMinor: 2000, currency: "USD" });
    expect(subtractMoney(a, b).amountMinor).toBe(1998);
    expect(multiplyMoney(money(10, "USD"), 3).amountMinor).toBe(30);
    expect(sumMoney([money(10, "USD"), money(20, "USD")], "USD").amountMinor).toBe(30);
  });

  it("rejects fractional quantities", () => {
    expect(() => multiplyMoney(money(100, "USD"), 1.5)).toThrow(MoneyError);
  });

  it("formats using the currency's minor unit", () => {
    expect(formatMoney(money(4800, "USD"))).toBe("$48.00");
    expect(formatMoney(money(0, "USD"))).toBe("$0.00");
  });

  it("validates currency codes", () => {
    expect(isCurrencyCode("USD")).toBe(true);
    expect(isCurrencyCode("XYZ")).toBe(false);
  });
});
