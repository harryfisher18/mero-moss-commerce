/** Where the console lands after sign-in when no valid destination is given. */
export const DEFAULT_ADMIN_PATH = "/admin/orders";

/**
 * Accepts only merchant-console paths as a post-login destination, preventing open
 * redirects (absolute URLs, protocol-relative `//host`, other sections, the login page).
 */
export function safeAdminPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 200) return DEFAULT_ADMIN_PATH;
  const valid = /^\/admin\/[a-z0-9/_-]*$/i.test(value) && !value.includes("//");
  if (!valid || value.startsWith("/admin/login")) return DEFAULT_ADMIN_PATH;
  return value;
}
