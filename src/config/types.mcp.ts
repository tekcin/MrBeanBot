/**
 * MCP (Model Context Protocol) server configuration.
 * Supports stdio (local) and SSE/HTTP (remote) transports.
 */
export type McpServerConfig = {
  /** Transport type: "stdio" for local subprocess, "sse" or "http" for remote. */
  type: "stdio" | "sse" | "http";
  /** Command to run (stdio only). */
  command?: string;
  /** Arguments for the command (stdio only). */
  args?: string[];
  /** Environment variables for the subprocess (stdio only). */
  env?: Record<string, string>;
  /** URL for SSE/HTTP transport (remote only). */
  url?: string;
  /** Headers for remote transport. */
  headers?: Record<string, string>;
  /** Enable/disable this server. Default: true. */
  enabled?: boolean;
};

export type McpConfig = Record<string, McpServerConfig>;
