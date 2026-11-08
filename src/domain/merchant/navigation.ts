/** Where the console lands after sign-in when no valid destination is given. */
export const DEFAULT_ADMIN_PATH = "/admin/orders";

/** Longest destination carried through sign-in. */
export const MAX_ADMIN_PATH_LENGTH = 2048;

const ADMIN_PATH = /^\/admin\/[a-z0-9/_-]*$/i;
// Printable ASCII only, which excludes spaces and control characters.
const SAFE_QUERY = /^[!-~]*$/;

/**
 * Accepts only merchant-console paths, optionally with a query, as a post-login
 * destination. This prevents open redirects: absolute URLs, protocol-relative `//host`,
 * backslash tricks, header injection, other sections and the login page are all refused.
 */
export function safeAdminPath(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_ADMIN_PATH_LENGTH) return DEFAULT_ADMIN_PATH;
  const separator = value.indexOf("?");
  const path = separator < 0 ? value : value.slice(0, separator);
  const query = separator < 0 ? "" : value.slice(separator + 1);
  const validPath =
    ADMIN_PATH.test(path) && !path.includes("//") && !path.startsWith("/admin/login");
  const validQuery = SAFE_QUERY.test(query) && !query.includes("\\") && !query.includes("#");
  return validPath && validQuery ? value : DEFAULT_ADMIN_PATH;
}

/** The page to return to after sign-in. An oversized query is dropped, not the page. */
export function adminLoginDestination(pathname: string, search: string): string {
  const full = `${pathname}${search}`;
  return full.length <= MAX_ADMIN_PATH_LENGTH ? full : pathname;
}
