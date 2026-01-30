/**
 * HTTP client for the MrBeanBot API v2.
 * Wraps the /api/v2/ REST endpoints with typed methods.
 */
import type {
  AgentInfo,
  McpPromptInfo,
  McpResourceInfo,
  McpServerStatus,
  McpToolInfo,
  ModelInfo,
  PermissionPending,
  ProviderInfo,
  SessionChatResult,
  SessionInfo,
  SseEvent,
} from "./types.js"

export type ClientOptions = {
  /** Base URL of the MrBeanBot gateway (e.g. "http://localhost:18789") */
  baseUrl: string
  /** Optional auth token */
  token?: string
  /** Custom fetch implementation (defaults to global fetch) */
  fetch?: typeof fetch
}

export function createClient(opts: ClientOptions) {
  const baseUrl = opts.baseUrl.replace(/\/$/, "")
  const fetchFn = opts.fetch ?? globalThis.fetch

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${baseUrl}/api/v2${path}`
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    }
    const res = await fetchFn(url, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string>) },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`MrBeanBot API error ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  }

  return {
    // ---- Health ----
    async health() {
      return request<{ status: string; timestamp: number }>("/health")
    },

    // ---- Sessions ----
    async listSessions() {
      return request<{ sessions: SessionInfo[] }>("/session")
    },

    async createSession(input?: { title?: string; parentID?: string }) {
      return request<{ session: SessionInfo }>("/session", {
        method: "POST",
        body: JSON.stringify(input ?? {}),
      })
    },

    async getSession(id: string) {
      return request<{ session: SessionInfo }>(`/session/${encodeURIComponent(id)}`)
    },

    async deleteSession(id: string) {
      return request<{ ok: boolean }>(`/session/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
    },

    async chat(sessionId: string, input: {
      message: string
      agentName?: string
      modelOverride?: { providerID: string; modelID: string }
      system?: string[]
    }) {
      return request<SessionChatResult>(
        `/session/${encodeURIComponent(sessionId)}/chat`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      )
    },

    async abortSession(sessionId: string) {
      return request<{ aborted: boolean }>(
        `/session/${encodeURIComponent(sessionId)}/abort`,
        { method: "POST" },
      )
    },

    // ---- Providers ----
    async listProviders() {
      return request<{ providers: ProviderInfo[] }>("/provider")
    },

    async listModels(providerId: string) {
      return request<{ models: ModelInfo[] }>(
        `/provider/${encodeURIComponent(providerId)}/models`,
      )
    },

    // ---- Agents ----
    async listAgents() {
      return request<{ agents: AgentInfo[] }>("/agent")
    },

    async getAgent(name: string) {
      return request<{ agent: AgentInfo }>(`/agent/${encodeURIComponent(name)}`)
    },

    // ---- Permission ----
    async pendingPermissions() {
      return request<{ pending: PermissionPending[] }>("/permission/pending")
    },

    async replyPermission(id: string, action: "allow" | "deny" = "allow") {
      return request<{ ok: boolean }>("/permission/reply", {
        method: "POST",
        body: JSON.stringify({ id, action }),
      })
    },

    // ---- MCP ----
    async mcpStatus() {
      return request<{ servers: Record<string, McpServerStatus> }>("/mcp/status")
    },

    async mcpTools() {
      return request<{ tools: McpToolInfo[] }>("/mcp/tools")
    },

    async mcpPrompts() {
      return request<{ prompts: McpPromptInfo[] }>("/mcp/prompts")
    },

    async mcpResources() {
      return request<{ resources: McpResourceInfo[] }>("/mcp/resources")
    },

    // ---- SSE Events ----
    /**
     * Subscribe to real-time events via SSE.
     * Returns an AsyncIterable of parsed SSE events.
     */
    async *events(signal?: AbortSignal): AsyncIterable<SseEvent> {
      const url = `${baseUrl}/api/v2/events`
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      }
      const res = await fetchFn(url, { headers, signal })
      if (!res.ok) {
        throw new Error(`SSE connection failed: ${res.status}`)
      }
      if (!res.body) {
        throw new Error("SSE response has no body")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let currentEvent = ""
      let currentData = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7)
            } else if (line.startsWith("data: ")) {
              currentData = line.slice(6)
            } else if (line === "") {
              if (currentEvent && currentData) {
                try {
                  const data = JSON.parse(currentData)
                  yield { event: currentEvent, data } as SseEvent
                } catch {
                  // Skip malformed events
                }
              }
              currentEvent = ""
              currentData = ""
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    },
  }
}

export type MrBeanBotClient = ReturnType<typeof createClient>
