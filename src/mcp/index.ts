/**
 * MCP (Model Context Protocol) client module ported from OpenCode.
 * Connects to MCP servers (stdio/HTTP/SSE), discovers tools, and exposes
 * them to the agent system as Vercel AI SDK tools.
 */
import { dynamicTool, type Tool, jsonSchema } from "ai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResultSchema,
  type Tool as MCPToolDef,
  ToolListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import z from "zod";
import { BusEvent } from "../bus/bus-event.js";
import { Bus } from "../bus/index.js";
import type { McpConfig } from "../config/types.mcp.js";

export namespace MCP {
  const DEFAULT_TIMEOUT = 30_000;

  export const ToolsChanged = BusEvent.define(
    "mcp.tools.changed",
    z.object({
      server: z.string(),
    }),
  );

  export type Status =
    | { status: "connected" }
    | { status: "disabled" }
    | { status: "failed"; error: string };

  type MCPClient = Client;

  /** Active MCP clients by server name. */
  const clients = new Map<string, MCPClient>();
  const statuses = new Map<string, Status>();
  let _initialized = false;

  /**
   * Initialize all MCP servers from config.
   */
  export async function init(config: McpConfig): Promise<void> {
    // Close existing clients
    await cleanup();

    await Promise.all(
      Object.entries(config).map(async ([name, serverConfig]) => {
        if (serverConfig.enabled === false) {
          statuses.set(name, { status: "disabled" });
          return;
        }

        try {
          const client = await connect(name, serverConfig);
          clients.set(name, client);
          statuses.set(name, { status: "connected" });
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          statuses.set(name, { status: "failed", error });
        }
      }),
    );
    _initialized = true;
  }

  /**
   * Connect to a single MCP server.
   */
  async function connect(name: string, config: McpConfig[string]): Promise<MCPClient> {
    const client = new Client(
      {
        name: "mrbeanbot",
        version: "1.0.0",
      },
      {
        capabilities: {
          roots: { listChanged: true },
        },
      },
    );

    // Register tool change notifications
    client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
      void Bus.publish(ToolsChanged, { server: name });
    });

    if (config.type === "stdio") {
      const command = config.command;
      if (!command) throw new Error(`MCP server "${name}" requires a command`);

      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (v !== undefined) env[k] = v;
      }
      if (config.env) Object.assign(env, config.env);

      const transport = new StdioClientTransport({
        command,
        args: config.args ?? [],
        env,
      });

      await client.connect(transport);
    } else if (config.type === "sse" || config.type === "http") {
      // Dynamic import for HTTP/SSE transports (may not be available)
      const url = config.url;
      if (!url) throw new Error(`MCP server "${name}" requires a url`);

      if (config.type === "http") {
        const { StreamableHTTPClientTransport } =
          await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
        const transport = new StreamableHTTPClientTransport(new URL(url), {
          requestInit: {
            headers: config.headers ?? {},
          },
        });
        await client.connect(transport);
      } else {
        const { SSEClientTransport } = await import("@modelcontextprotocol/sdk/client/sse.js");
        const transport = new SSEClientTransport(new URL(url), {
          requestInit: {
            headers: config.headers ?? {},
          },
        });
        await client.connect(transport);
      }
    } else {
      throw new Error(
        `MCP server "${name}" has unsupported type: ${(config as { type: string }).type}`,
      );
    }

    return client;
  }

  /**
   * Get all tools from connected MCP servers as Vercel AI SDK tools.
   */
  export async function tools(): Promise<Record<string, Tool>> {
    const result: Record<string, Tool> = {};

    for (const [name, client] of clients) {
      try {
        const { tools: mcpTools } = await client.listTools();
        const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, "_");

        for (const mcpTool of mcpTools) {
          const toolName = `${sanitizedName}_${mcpTool.name}`;
          result[toolName] = convertMcpTool(mcpTool, client);
        }
      } catch {
        // Server may have disconnected
      }
    }

    return result;
  }

  /**
   * Convert a single MCP tool definition to Vercel AI SDK format.
   */
  function convertMcpTool(mcpTool: MCPToolDef, client: MCPClient, timeout?: number): Tool {
    const inputSchema = mcpTool.inputSchema;
    const schema = {
      ...inputSchema,
      type: "object" as const,
      properties: (inputSchema.properties ?? {}) as Record<string, unknown>,
      additionalProperties: false,
    };

    return dynamicTool({
      description: mcpTool.description ?? "",
      inputSchema: jsonSchema(schema),
      execute: async (args: unknown) => {
        return client.callTool(
          {
            name: mcpTool.name,
            arguments: args as Record<string, unknown>,
          },
          CallToolResultSchema,
          {
            resetTimeoutOnProgress: true,
            timeout: timeout ?? DEFAULT_TIMEOUT,
          },
        );
      },
    });
  }

  /**
   * Get status of all configured MCP servers.
   */
  export function status(): Record<string, Status> {
    return Object.fromEntries(statuses);
  }

  /**
   * Disconnect a specific MCP server.
   */
  export async function disconnect(name: string): Promise<void> {
    const client = clients.get(name);
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
      clients.delete(name);
      statuses.delete(name);
    }
  }

  /**
   * Reconnect a specific MCP server.
   */
  export async function reconnect(name: string, config: McpConfig[string]): Promise<void> {
    await disconnect(name);
    try {
      const client = await connect(name, config);
      clients.set(name, client);
      statuses.set(name, { status: "connected" });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      statuses.set(name, { status: "failed", error });
    }
  }

  /**
   * Clean up all MCP clients.
   */
  export async function cleanup(): Promise<void> {
    await Promise.all(Array.from(clients.values()).map((client) => client.close().catch(() => {})));
    clients.clear();
    statuses.clear();
    _initialized = false;
  }

  /**
   * List available prompts from all connected MCP servers.
   */
  export async function listPrompts(): Promise<
    Array<{
      name: string;
      description?: string;
      client: string;
    }>
  > {
    const result: Array<{ name: string; description?: string; client: string }> = [];

    for (const [name, client] of clients) {
      try {
        const { prompts } = await client.listPrompts();
        const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
        for (const prompt of prompts) {
          result.push({
            name: `${sanitizedName}:${prompt.name}`,
            description: prompt.description,
            client: name,
          });
        }
      } catch {
        // Server may have disconnected
      }
    }

    return result;
  }

  /**
   * List available resources from all connected MCP servers.
   */
  export async function listResources(): Promise<
    Array<{
      name: string;
      uri: string;
      description?: string;
      mimeType?: string;
      client: string;
    }>
  > {
    const result: Array<{
      name: string;
      uri: string;
      description?: string;
      mimeType?: string;
      client: string;
    }> = [];

    for (const [name, client] of clients) {
      try {
        const { resources } = await client.listResources();
        for (const resource of resources) {
          result.push({
            name: resource.name,
            uri: resource.uri,
            description: resource.description,
            mimeType: resource.mimeType,
            client: name,
          });
        }
      } catch {
        // Server may have disconnected
      }
    }

    return result;
  }
}
