import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Merchant credential rules. Passwords are stored only as scrypt hashes in the format
 * `scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>`; comparisons are timing-safe.
 */

const KEY_LENGTH = 32;
const DEFAULT_COST = { N: 16384, r: 8, p: 1 } as const;

export function hashPassword(password: string, salt: Buffer = randomBytes(16)): string {
  const { N, r, p } = DEFAULT_COST;
  const hash = scryptSync(password, salt, KEY_LENGTH, { N, r, p });
  return ["scrypt", N, r, p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltText, hashText] = parts as [string, string, string, string, string, string];
  const N = Number(n);
  const R = Number(r);
  const P = Number(p);
  if (![N, R, P].every((value) => Number.isSafeInteger(value) && value > 0)) return false;
  // Bound the work factor so a malformed configuration cannot exhaust memory.
  if (N > 2 ** 17 || R > 16 || P > 4) return false;
  const expected = Buffer.from(hashText, "base64url");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = scryptSync(password, Buffer.from(saltText, "base64url"), KEY_LENGTH, {
    N,
    r: R,
    p: P,
  });
  return timingSafeEqual(actual, expected);
}

/** Case-insensitive, whitespace-tolerant email comparison in constant time. */
export function emailsMatch(submitted: string, configured: string): boolean {
  const a = Buffer.from(submitted.trim().toLowerCase());
  const b = Buffer.from(configured.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export const LOGIN_RATE_LIMIT = { maxFailures: 5, windowMinutes: 15 } as const;

/** True when the number of recent failures has reached the limit. */
export function isLoginLocked(recentFailures: number): boolean {
  return recentFailures >= LOGIN_RATE_LIMIT.maxFailures;
}
