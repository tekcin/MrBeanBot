/**
 * Bridge adapter between MrBeanBot's existing auto-reply/gateway system
 * and the new OpenCode-derived Session/LLM/Provider system.
 *
 * This adapter provides the same interface as the old Pi-embedded runner,
 * allowing a gradual migration where existing call sites continue to work
 * while the underlying implementation uses the new Vercel AI SDK.
 *
 * Usage: Replace `runEmbeddedPiAgent(...)` calls with `runSessionAgent(...)`.
 * The bridge translates the Pi-style parameters into Session.chat() calls
 * and adapts the return values back.
 */
import { Session } from "../sessions/session.js";
import { Bus } from "../bus/index.js";
import { MessageV2 } from "../sessions/message-v2.js";
import type { Tool } from "ai";

export interface SessionAgentRunOptions {
  /** The session key for this run (maps to Pi's sessionId). */
  sessionKey: string;
  /** The user's message text. */
  message: string;
  /** Agent name to use (e.g., "build", "general"). */
  agentName?: string;
  /** Model override as "providerID/modelID". */
  modelOverride?: string;
  /** System prompt additions. */
  systemPrompts?: string[];
  /** Tools available for this agent run. */
  tools?: Record<string, Tool>;
  /** Abort signal for cancellation. */
  abort?: AbortSignal;
  /** Callback for streaming text deltas. */
  onTextDelta?: (text: string, fullText: string) => void;
  /** Callback for tool execution events. */
  onToolEvent?: (event: {
    tool: string;
    status: "pending" | "running" | "completed" | "error";
    input?: unknown;
    output?: string;
    error?: string;
  }) => void;
  /** Callback when the run completes or errors. */
  onComplete?: (result: SessionAgentRunResult) => void;
}

export interface SessionAgentRunResult {
  /** Final accumulated text from the assistant. */
  text: string;
  /** Whether the run completed successfully. */
  success: boolean;
  /** Error information if the run failed. */
  error?: { name: string; message: string };
  /** Token usage from the run. */
  tokens?: { input: number; output: number };
}

/**
 * Run the new session-based agent with the same external contract as
 * the old Pi embedded runner.
 *
 * Subscribes to Bus events to relay streaming deltas and tool events
 * to the caller via callbacks, matching the old AgentEventPayload pattern.
 */
export async function runSessionAgent(
  options: SessionAgentRunOptions,
): Promise<SessionAgentRunResult> {
  let fullText = "";

  // Parse model override from "providerID/modelID" format
  let modelOverride: { providerID: string; modelID: string } | undefined;
  if (options.modelOverride) {
    const [providerID, ...rest] = options.modelOverride.split("/");
    if (providerID && rest.length > 0) {
      modelOverride = { providerID, modelID: rest.join("/") };
    }
  }

  // Subscribe to Bus events to relay streaming data
  const unsubText = Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
    const { part, delta } = event.properties as any;
    if (part.type === "text" && delta && options.onTextDelta) {
      fullText = part.text;
      options.onTextDelta(delta, fullText);
    }
    if (part.type === "tool" && options.onToolEvent) {
      options.onToolEvent({
        tool: part.tool,
        status: part.state.status,
        input: part.state.input,
        output: part.state.status === "completed" ? part.state.output : undefined,
        error: part.state.status === "error" ? part.state.error : undefined,
      });
    }
  });

  try {
    const result = await Session.chat({
      sessionID: options.sessionKey,
      message: options.message,
      agentName: options.agentName,
      modelOverride,
      system: options.systemPrompts,
      tools: options.tools,
      abort: options.abort,
    });

    const runResult: SessionAgentRunResult = {
      text: fullText || result.text,
      success: !result.error,
      error: result.error,
      tokens: result.tokens,
    };

    options.onComplete?.(runResult);
    return runResult;
  } catch (e) {
    const error =
      e instanceof Error
        ? { name: e.constructor.name, message: e.message }
        : { name: "UnknownError", message: String(e) };

    const runResult: SessionAgentRunResult = {
      text: fullText,
      success: false,
      error,
    };

    options.onComplete?.(runResult);
    return runResult;
  } finally {
    unsubText();
  }
}

/**
 * Abort an active agent run by session key.
 * Maps to the old `abortEmbeddedPiRun()` function.
 */
export function abortSessionAgent(sessionKey: string): boolean {
  return Session.abort(sessionKey);
}
