/**
 * API v2 routes - OpenCode-style REST API mounted at /api/v2/.
 * Uses Hono for routing, integrated into MrBeanBot's existing gateway
 * via the Hono adapter layer.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Session } from "../../sessions/session.js";
import { Provider } from "../../providers/provider.js";
import { AgentDef } from "../../agents/agent-definitions.js";
import { PermissionNext } from "../../permission/next.js";
import { MCP } from "../../mcp/index.js";

/**
 * Create all v2 API routes.
 * Mounted at /api/v2/ in the gateway.
 */
export function createApiV2Routes(): Hono {
  const app = new Hono();

  // CORS
  app.use("*", cors());

  // ---- Health ----
  app.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

  // ---- Sessions ----
  app.get("/session", async (c) => {
    const sessions = await Session.list();
    return c.json({ sessions });
  });

  app.post("/session", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const session = await Session.create({
      title: body.title,
      parentID: body.parentID,
    });
    return c.json({ session });
  });

  app.get("/session/:id", async (c) => {
    try {
      const session = await Session.get(c.req.param("id"));
      return c.json({ session });
    } catch {
      return c.json({ error: "Session not found" }, 404);
    }
  });

  app.delete("/session/:id", async (c) => {
    await Session.remove(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.post("/session/:id/chat", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const result = await Session.chat({
      sessionID: id,
      message: body.message,
      agentName: body.agentName,
      modelOverride: body.modelOverride,
      system: body.system,
    });
    return c.json(result);
  });

  app.post("/session/:id/abort", async (c) => {
    const aborted = Session.abort(c.req.param("id"));
    return c.json({ aborted });
  });

  // ---- Providers ----
  app.get("/provider", async (c) => {
    const providersMap = await Provider.list();
    const providers = Object.values(providersMap);
    return c.json({
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
      })),
    });
  });

  app.get("/provider/:id/models", async (c) => {
    const providerId = c.req.param("id");
    const providersMap = await Provider.list();
    const provider = providersMap[providerId];
    if (!provider) {
      return c.json({ error: "Provider not found" }, 404);
    }
    const models = Object.values(provider.models);
    return c.json({
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        providerID: m.providerID,
      })),
    });
  });

  // ---- Agents ----
  app.get("/agent", (c) => {
    const agents = AgentDef.listVisible();
    return c.json({ agents });
  });

  app.get("/agent/:name", (c) => {
    const agent = AgentDef.get(c.req.param("name"));
    if (!agent) {
      return c.json({ error: "Agent not found" }, 404);
    }
    return c.json({ agent });
  });

  // ---- Permission ----
  app.get("/permission/pending", async (c) => {
    const pending = await PermissionNext.list();
    return c.json({ pending });
  });

  app.post("/permission/reply", async (c) => {
    const body = await c.req.json();
    await PermissionNext.reply({
      requestID: body.id,
      reply: body.action ?? "once",
    });
    return c.json({ ok: true });
  });

  // ---- MCP ----
  app.get("/mcp/status", (c) => {
    const mcpStatus = MCP.status();
    return c.json({ servers: mcpStatus });
  });

  app.get("/mcp/tools", async (c) => {
    const tools = await MCP.tools();
    return c.json({
      tools: Object.keys(tools).map((name) => ({ name })),
    });
  });

  app.get("/mcp/prompts", async (c) => {
    const prompts = await MCP.listPrompts();
    return c.json({ prompts });
  });

  app.get("/mcp/resources", async (c) => {
    const resources = await MCP.listResources();
    return c.json({ resources });
  });

  return app;
}
