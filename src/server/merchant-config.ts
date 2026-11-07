/**
 * Merchant console credentials. Configure real ones with MERCHANT_EMAIL and
 * MERCHANT_PASSWORD_HASH (generate with `npm run merchant:hash -- "<password>"`).
 *
 * Without them the console uses a PUBLIC, documented demo login so anyone evaluating
 * the demo can sign in. The login page shows these credentials whenever they are active.
 */
export const DEMO_MERCHANT_EMAIL = "merchant@meroandmoss.example";
export const DEMO_MERCHANT_PASSWORD = "moss-demo-2026";
const DEMO_MERCHANT_PASSWORD_HASH =
  "scrypt$16384$8$1$bWVyby1tb3NzLWRlbW8tc2FsdA$DLqb7SD7SezhZ0PpjEGcRLFnxF864WUoYsWGx2nJFrk";

export interface MerchantCredentials {
  readonly email: string;
  readonly passwordHash: string;
  readonly isDemo: boolean;
}

export function merchantCredentials(
  env: Readonly<Record<string, string | undefined>> = process.env,
): MerchantCredentials {
  const email = env.MERCHANT_EMAIL?.trim();
  const passwordHash = env.MERCHANT_PASSWORD_HASH?.trim();
  if (email && passwordHash) return { email, passwordHash, isDemo: false };
  return {
    email: DEMO_MERCHANT_EMAIL,
    passwordHash: DEMO_MERCHANT_PASSWORD_HASH,
    isDemo: true,
  };
}
