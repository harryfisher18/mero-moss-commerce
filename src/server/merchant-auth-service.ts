import { createHash, randomBytes } from "node:crypto";
import {
  emailsMatch,
  isLoginLocked,
  LOGIN_RATE_LIMIT,
  verifyPassword,
} from "@/domain/merchant/credentials";
import { type Database, withTransaction } from "@/server/db/database";
import { type MerchantCredentials, merchantCredentials } from "@/server/merchant-config";

export const SESSION_TTL_HOURS = 8;
/** Name of the httpOnly cookie that carries the raw merchant session token. */
export const MERCHANT_COOKIE = "mm_admin";
const MINUTE_MS = 60_000;

export interface MerchantSession {
  readonly email: string;
  readonly expiresAt: string;
}

export type LoginResult =
  | { readonly ok: true; readonly token: string; readonly expiresAt: string }
  | { readonly ok: false; readonly reason: "invalid" | "locked" };

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Merchant authentication backed by SQLite sessions. The browser holds a random 256-bit
 * token; the database stores only its SHA-256 digest, so a leaked database cannot be
 * replayed as a session. Failed logins are rate limited per email.
 */
export class MerchantAuthService {
  constructor(
    private readonly db: Database,
    private readonly credentials: MerchantCredentials = merchantCredentials(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  login(email: string, password: string): LoginResult {
    const normalized = email.trim().toLowerCase().slice(0, 254);
    const now = this.now();
    const windowStart = new Date(now.getTime() - LOGIN_RATE_LIMIT.windowMinutes * MINUTE_MS);

    return withTransaction(this.db, (): LoginResult => {
      const failures = Number(
        this.db
          .prepare(
            `SELECT COUNT(*) AS n FROM login_attempts
             WHERE email = ? AND succeeded = 0 AND attempted_at >= ?`,
          )
          .get(normalized, windowStart.toISOString())?.n ?? 0,
      );
      if (isLoginLocked(failures)) return { ok: false, reason: "locked" };

      // Always run the password check so response time does not reveal valid emails.
      const passwordOk = verifyPassword(password, this.credentials.passwordHash);
      const ok = emailsMatch(normalized, this.credentials.email) && passwordOk;
      this.db
        .prepare("INSERT INTO login_attempts (email, succeeded, attempted_at) VALUES (?, ?, ?)")
        .run(normalized, ok ? 1 : 0, now.toISOString());
      if (!ok) return { ok: false, reason: "invalid" };

      this.db.prepare("DELETE FROM merchant_sessions WHERE expires_at <= ?").run(now.toISOString());
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * MINUTE_MS).toISOString();
      this.db
        .prepare(
          "INSERT INTO merchant_sessions (token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)",
        )
        .run(digest(token), normalized, now.toISOString(), expiresAt);
      return { ok: true, token, expiresAt };
    });
  }

  verify(token: string | undefined): MerchantSession | null {
    if (!token || token.length > 100) return null;
    const row = this.db
      .prepare("SELECT email, expires_at FROM merchant_sessions WHERE token_hash = ?")
      .get(digest(token));
    if (!row) return null;
    const expiresAt = String(row.expires_at);
    if (expiresAt <= this.now().toISOString()) return null;
    return { email: String(row.email), expiresAt };
  }

  logout(token: string | undefined): void {
    if (token)
      this.db.prepare("DELETE FROM merchant_sessions WHERE token_hash = ?").run(digest(token));
  }
}
