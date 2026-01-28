/**
 * WebSocket and HTTP origin validation.
 *
 * Loopback origins (http://localhost, http://127.0.0.1, http://[::1] and
 * their port variants) are always allowed. Additional origins can be
 * configured via `gateway.cors.allowedOrigins`.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function extractHost(origin: string): string | null {
  try {
    const url = new URL(origin);
    return url.hostname;
  } catch {
    return null;
  }
}

function isLoopbackOrigin(origin: string): boolean {
  const host = extractHost(origin);
  if (!host) return false;
  if (LOOPBACK_HOSTS.has(host)) return true;
  if (host.startsWith("127.")) return true;
  return false;
}

/**
 * Check whether the given origin is allowed by the configured policy.
 *
 * Returns `true` when:
 * - origin is undefined/empty (non-browser clients like CLI, curl — no Origin header)
 * - origin is a loopback address
 * - allowedOrigins includes "*"
 * - origin matches one of the configured allowedOrigins (exact match)
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[] | undefined,
): boolean {
  // Non-browser clients (CLI, curl, etc.) don't send Origin headers — always allowed.
  if (!origin || origin.trim() === "") return true;

  // Loopback origins are always allowed.
  if (isLoopbackOrigin(origin)) return true;

  // If no explicit allowlist, only loopback origins are allowed.
  if (!allowedOrigins || allowedOrigins.length === 0) return false;

  // Wildcard allows everything.
  if (allowedOrigins.includes("*")) return true;

  // Exact match against configured origins.
  const normalized = origin.toLowerCase().replace(/\/+$/, "");
  return allowedOrigins.some((allowed) => allowed.toLowerCase().replace(/\/+$/, "") === normalized);
}
