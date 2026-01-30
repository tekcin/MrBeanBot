/**
 * SSE streaming endpoint for Bus events.
 * Allows clients to subscribe to real-time session, message, and tool events.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { Bus } from "../bus/index.js";
import { Session } from "../sessions/session.js";
import { MessageV2 } from "../sessions/message-v2.js";
import { MCP } from "../mcp/index.js";

/**
 * Handle SSE event stream requests at /api/v2/events.
 * Returns true if handled, false otherwise.
 */
export async function handleSseEventStream(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = req.url ?? "/";
  if (!url.startsWith("/api/v2/events")) return false;
  if (req.method !== "GET") return false;

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Helper to send SSE events
  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial heartbeat
  send("connected", { timestamp: Date.now() });

  // Subscribe to Bus events
  const unsubscribers: Array<() => void> = [];

  // Session events
  unsubscribers.push(
    Bus.subscribe(Session.Event.Created, (event) => {
      send("session.created", event.properties);
    }),
  );
  unsubscribers.push(
    Bus.subscribe(Session.Event.Updated, (event) => {
      send("session.updated", event.properties);
    }),
  );
  unsubscribers.push(
    Bus.subscribe(Session.Event.Deleted, (event) => {
      send("session.deleted", event.properties);
    }),
  );
  unsubscribers.push(
    Bus.subscribe(Session.Event.Error, (event) => {
      send("session.error", event.properties);
    }),
  );

  // Message part events (text, tool, reasoning updates)
  unsubscribers.push(
    Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
      send("message.part.updated", event.properties);
    }),
  );

  // MCP events
  unsubscribers.push(
    Bus.subscribe(MCP.ToolsChanged, (event) => {
      send("mcp.tools.changed", event.properties);
    }),
  );

  // Heartbeat timer to keep connection alive
  const heartbeat = setInterval(() => {
    send("heartbeat", { timestamp: Date.now() });
  }, 30_000);

  // Cleanup on close
  req.on("close", () => {
    clearInterval(heartbeat);
    for (const unsub of unsubscribers) {
      unsub();
    }
  });

  return true;
}
