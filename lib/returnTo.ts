// Where the OAuth callback may send the browser afterwards. A strict allow-list of our own paths,
// so a crafted `?return=` can never turn the flow into an open redirect.

const ALLOWED_PATHS = new Set(["/connect-done", "/connections", "/new"]);
const PLACEHOLDER_ORIGIN = "http://buildman.invalid";

export function safeReturn(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return null;
  // Must be a plain absolute path: no protocol-relative `//host`, no backslashes, no control characters.
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const u = new URL(value, PLACEHOLDER_ORIGIN);
    if (u.origin !== PLACEHOLDER_ORIGIN || !ALLOWED_PATHS.has(u.pathname)) return null;
    return u.pathname + u.search;
  } catch {
    return null;
  }
}

/** Adds/overwrites query parameters on a path returned by `safeReturn`. */
export function withParams(path: string, params: Record<string, string>): string {
  const u = new URL(path, PLACEHOLDER_ORIGIN);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.pathname + u.search;
}
