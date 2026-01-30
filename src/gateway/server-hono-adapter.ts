/**
 * Hono adapter for MrBeanBot's raw Node.js HTTP server.
 * Converts between Node IncomingMessage/ServerResponse and Hono's fetch API.
 * Mounts OpenCode-style API routes at /api/v2/.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { Hono } from "hono";
import { createApiV2Routes } from "./routes/api-v2.js";

let honoApp: Hono | undefined;

/**
 * Get or create the Hono app with all v2 API routes.
 */
function getHonoApp(): Hono {
  if (!honoApp) {
    honoApp = new Hono();
    honoApp.route("/api/v2", createApiV2Routes());
  }
  return honoApp;
}

/**
 * Handle an incoming HTTP request via the Hono app.
 * Returns true if the request was handled, false otherwise.
 *
 * Insert this into the gateway's handler chain:
 * ```
 * if (await handleHonoApiRequest(req, res)) return;
 * ```
 */
export async function handleHonoApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = req.url ?? "/";

  // Only handle /api/v2/ paths
  if (!url.startsWith("/api/v2")) return false;

  try {
    const app = getHonoApp();

    // Read request body for non-GET methods
    let body: ReadableStream<Uint8Array> | null = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = new ReadableStream({
        start(controller) {
          req.on("data", (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk));
          });
          req.on("end", () => {
            controller.close();
          });
          req.on("error", (err) => {
            controller.error(err);
          });
        },
      });
    }

    // Build the full URL
    const host = req.headers.host ?? "localhost";
    const protocol = (req.socket as { encrypted?: boolean }).encrypted ? "https" : "http";
    const fullUrl = `${protocol}://${host}${url}`;

    // Convert headers
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, value);
      }
    }

    // Create a fetch-compatible Request
    const request = new Request(fullUrl, {
      method: req.method ?? "GET",
      headers,
      body,
      // @ts-expect-error Node.js Request supports duplex
      duplex: body ? "half" : undefined,
    });

    // Execute via Hono
    const response = await app.fetch(request);

    // Write response back
    res.writeHead(response.status, Object.fromEntries(response.headers));
    const responseBody = await response.arrayBuffer();
    res.end(Buffer.from(responseBody));

    return true;
  } catch (e) {
    // Error handling: return 500
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Internal server error",
      }),
    );
    return true;
  }
}

/**
 * Reset the Hono app (for testing or reinitialization).
 */
export function resetHonoApp(): void {
  honoApp = undefined;
}
