/**
 * Shared types for the MrBeanBot API v2.
 * These mirror the shapes returned by the /api/v2/ endpoints.
 */

export type SessionInfo = {
  id: string
  title: string
  projectID?: string
  directory?: string
  parentID?: string
  version?: string
  time: {
    created: number
    updated: number
    compacting?: number
  }
}

export type SessionChatResult = {
  text: string
  error?: { name: string; message: string }
  tokens?: { input: number; output: number }
}

export type ProviderInfo = {
  id: string
  name: string
}

export type ModelInfo = {
  id: string
  name: string
  providerID: string
}

export type AgentInfo = {
  name: string
  description?: string
  system?: string[]
  mode?: "primary" | "subagent"
  model?: { providerID: string; modelID: string }
  visible?: boolean
}

export type PermissionPending = {
  id: string
  sessionID: string
  tool: string
  args?: Record<string, unknown>
}

export type McpServerStatus = {
  status: "connected" | "disabled" | "failed"
  error?: string
}

export type McpToolInfo = {
  name: string
}

export type McpPromptInfo = {
  name: string
  description?: string
  client: string
}

export type McpResourceInfo = {
  name: string
  uri: string
  description?: string
  mimeType?: string
  client: string
}

export type SseEvent =
  | { event: "connected"; data: { timestamp: number } }
  | { event: "heartbeat"; data: { timestamp: number } }
  | { event: "session.created"; data: { info: SessionInfo } }
  | { event: "session.updated"; data: { info: SessionInfo } }
  | { event: "session.deleted"; data: { info: SessionInfo } }
  | { event: "session.error"; data: { sessionID?: string; error: { name: string; message: string } } }
  | { event: "message.part.updated"; data: unknown }
  | { event: "mcp.tools.changed"; data: { server: string } }
