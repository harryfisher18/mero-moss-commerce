/**
 * Money is always stored as an integer amount of minor units (e.g. cents)
 * together with an ISO 4217 currency code. Floats are never used for money.
 */

export const SUPPORTED_CURRENCIES = ["USD"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

export class MoneyError extends Error {
  override name = "MoneyError";
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function money(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new MoneyError(`Money amount must be a safe integer of minor units, got ${amountMinor}`);
  }
  return { amountMinor, currency };
}

export function zero(currency: CurrencyCode): Money {
  return money(0, currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function multiplyMoney(value: Money, quantity: number): Money {
  if (!Number.isSafeInteger(quantity)) {
    throw new MoneyError(`Quantity must be an integer, got ${quantity}`);
  }
  return money(value.amountMinor * quantity, value.currency);
}

export function sumMoney(values: readonly Money[], currency: CurrencyCode): Money {
  return values.reduce<Money>((total, value) => addMoney(total, value), zero(currency));
}

export function formatMoney(value: Money, locale = "en-US"): string {
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency: value.currency });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(value.amountMinor / 10 ** fractionDigits);
}

/** Largest price a merchant may enter, in minor units ($99,999.99). */
export const MAX_PRICE_MINOR = 9_999_999;

/**
 * Parses merchant-entered amounts such as "48", "48.5", "$1,048.50" into integer minor
 * units without floating-point arithmetic. Returns null for anything else, including
 * negative values, more than two decimals, or amounts above MAX_PRICE_MINOR.
 */
export function parseMoneyInput(text: string, currency: CurrencyCode): Money | null {
  const cleaned = text
    .trim()
    .replace(/^\$/, "")
    .replace(/,(?=\d{3}(\D|$))/g, "");
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const amountMinor = whole * 100 + fraction;
  if (amountMinor > MAX_PRICE_MINOR) return null;
  return money(amountMinor, currency);
}

/** Formats minor units as a plain decimal string for form inputs, e.g. 4850 → "48.50". */
export function toDecimalString(value: Money): string {
  const whole = Math.trunc(value.amountMinor / 100);
  const fraction = String(Math.abs(value.amountMinor % 100)).padStart(2, "0");
  return `${whole}.${fraction}`;
}
