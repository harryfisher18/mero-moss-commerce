/**
 * Merchant settings rules. Pure. Settings are read from server configuration and shown as
 * "set" or "not set": secret values never leave the server.
 */

export type Env = Readonly<Record<string, string | undefined>>;

const isSet = (env: Env, name: string) => Boolean(env[name]?.trim());

export interface SettingRow {
  readonly name: string;
  readonly purpose: string;
  readonly state: "Set" | "Not set";
}

export interface SettingsGroup {
  readonly title: string;
  readonly rows: readonly SettingRow[];
}

export function settingsGroups(env: Env): SettingsGroup[] {
  const row = (name: string, purpose: string): SettingRow => ({
    name,
    purpose,
    state: isSet(env, name) ? "Set" : "Not set",
  });
  return [
    {
      title: "Merchant login",
      rows: [
        row("MERCHANT_EMAIL", "Email address for the console login"),
        row("MERCHANT_PASSWORD_HASH", "Hashed password for the console login"),
      ],
    },
    {
      title: "Data",
      rows: [
        row("MERO_MOSS_DB_PATH", "Location of the store database (a default is used if unset)"),
      ],
    },
    {
      title: "AI",
      rows: [
        row("ANTHROPIC_API_KEY", "Turns on optional Claude wording and drafts"),
        row("ADVISOR_MODEL", "Model for the shopping advisor's wording"),
        row("CONTENT_MODEL", "Model for Content Studio drafts"),
      ],
    },
    {
      title: "Shopify",
      rows: [
        row("SHOPIFY_STORE_DOMAIN", "Store address"),
        row("SHOPIFY_ADMIN_ACCESS_TOKEN", "Read-only Admin API token"),
        row("SHOPIFY_API_VERSION", "Admin API version"),
        row("SHOPIFY_WEBHOOK_SECRET", "Secret for verifying webhook signatures"),
      ],
    },
  ];
}

/** Typed by the merchant to confirm a reset, so it can't happen by accident. */
export const RESET_CONFIRMATION = "reset demo store";

export type ResetCheck =
  { readonly ok: true } | { readonly ok: false; readonly reason: "not_demo" | "not_confirmed" };

/**
 * A reset wipes every order, cart and record. It is allowed only while the public demo
 * login is active, so a store with real merchant credentials can never be wiped this way.
 */
export function checkDemoReset(input: { isDemo: boolean; confirmation: string }): ResetCheck {
  if (!input.isDemo) return { ok: false, reason: "not_demo" };
  if (input.confirmation.trim().toLowerCase() !== RESET_CONFIRMATION) {
    return { ok: false, reason: "not_confirmed" };
  }
  return { ok: true };
}
