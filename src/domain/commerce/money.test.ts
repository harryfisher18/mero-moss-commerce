import { describe, expect, it } from "vitest";
import {
  addMoney,
  formatMoney,
  isCurrencyCode,
  MAX_PRICE_MINOR,
  money,
  MoneyError,
  multiplyMoney,
  parseMoneyInput,
  subtractMoney,
  sumMoney,
  toDecimalString,
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

describe("parseMoneyInput", () => {
  it("parses common merchant formats exactly", () => {
    expect(parseMoneyInput("48", "USD")?.amountMinor).toBe(4800);
    expect(parseMoneyInput("48.5", "USD")?.amountMinor).toBe(4850);
    expect(parseMoneyInput(" 48.05 ", "USD")?.amountMinor).toBe(4805);
    expect(parseMoneyInput("$1,048.50", "USD")?.amountMinor).toBe(104850);
    expect(parseMoneyInput("0.10", "USD")?.amountMinor).toBe(10);
    // Classic float traps stay exact.
    expect(parseMoneyInput("19.99", "USD")?.amountMinor).toBe(1999);
    expect(parseMoneyInput("1.15", "USD")?.amountMinor).toBe(115);
  });

  it("rejects invalid, negative, over-precise and oversized amounts", () => {
    for (const bad of ["", "abc", "-5", "4.999", "1e3", "12.", ".5", "1,00", "100000.00"]) {
      expect(parseMoneyInput(bad, "USD")).toBeNull();
    }
    expect(parseMoneyInput("99999.99", "USD")?.amountMinor).toBe(MAX_PRICE_MINOR);
  });

  it("round-trips through toDecimalString", () => {
    expect(toDecimalString(money(4805, "USD"))).toBe("48.05");
    expect(toDecimalString(money(0, "USD"))).toBe("0.00");
    expect(parseMoneyInput(toDecimalString(money(123456, "USD")), "USD")?.amountMinor).toBe(123456);
  });
});
