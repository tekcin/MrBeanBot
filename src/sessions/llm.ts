/**
 * LLM streaming module ported from OpenCode.
 * Wraps Vercel AI SDK's streamText() with MrBeanBot-specific transformations.
 */
import {
  streamText,
  wrapLanguageModel,
  extractReasoningMiddleware,
  type CoreMessage,
  type StreamTextResult,
  type Tool,
  type ToolSet,
} from "ai";
import { Provider } from "../providers/provider.js";
import { PermissionNext } from "../permission/next.js";
import type { AgentDef } from "../agents/agent-definitions.js";
import type { MessageV2 } from "./message-v2.js";

export namespace LLM {
  export const OUTPUT_TOKEN_MAX = 32_000;

  export type StreamInput = {
    user: MessageV2.User;
    sessionID: string;
    model: Provider.Model;
    agent: AgentDef.Info;
    system: string[];
    abort: AbortSignal;
    messages: CoreMessage[];
    small?: boolean;
    tools: Record<string, Tool>;
    retries?: number;
  };

  export type StreamOutput = StreamTextResult<ToolSet, unknown>;

  export async function stream(input: StreamInput): Promise<StreamOutput> {
    const language = await Provider.getLanguage(input.model);

    const system: string[] = [];
    // Agent prompt or default provider prompt
    if (input.agent.prompt) {
      system.push(input.agent.prompt);
    }
    // Custom system prompts passed in
    system.push(...input.system);
    // User message system prompt
    if (input.user.system) {
      system.push(input.user.system);
    }

    const tools = await resolveTools(input);

    // Calculate temperature and options
    const temperature = input.model.capabilities?.temperature
      ? (input.agent.temperature ?? 0)
      : undefined;

    return streamText({
      onError(_error) {
        // Logged upstream by processor
      },
      async experimental_repairToolCall(failed) {
        const lower = failed.toolCall.toolName.toLowerCase();
        if (lower !== failed.toolCall.toolName && tools[lower]) {
          return {
            ...failed.toolCall,
            toolName: lower,
          };
        }
        return {
          ...failed.toolCall,
          input: JSON.stringify({
            tool: failed.toolCall.toolName,
            error: failed.error.message,
          }),
          toolName: "invalid",
        };
      },
      temperature,
      topP: input.agent.topP,
      providerOptions: {},
      tools,
      maxOutputTokens: input.model.limit.output
        ? Math.min(input.model.limit.output, OUTPUT_TOKEN_MAX)
        : OUTPUT_TOKEN_MAX,
      abortSignal: input.abort,
      headers: {
        "User-Agent": "mrbeanbot/1.0",
        ...input.model.headers,
      },
      maxRetries: input.retries ?? 0,
      messages: [
        ...system.map(
          (x): CoreMessage => ({
            role: "system",
            content: x,
          }),
        ),
        ...input.messages,
      ],
      model: wrapLanguageModel({
        model: language,
        middleware: [extractReasoningMiddleware({ tagName: "think", startWithReasoning: false })],
      }),
    });
  }

  async function resolveTools(
    input: Pick<StreamInput, "tools" | "agent" | "user">,
  ): Promise<Record<string, Tool>> {
    const disabled = PermissionNext.disabled(Object.keys(input.tools), input.agent.permission);
    for (const toolName of Object.keys(input.tools)) {
      if (input.user.tools?.[toolName] === false || disabled.has(toolName)) {
        delete input.tools[toolName];
      }
    }
    return input.tools;
  }

  /**
   * Check if messages contain any tool-call content.
   * Used for LiteLLM proxy compatibility.
   */
  export function hasToolCalls(messages: CoreMessage[]): boolean {
    for (const msg of messages) {
      if (!Array.isArray(msg.content)) continue;
      for (const part of msg.content) {
        if (part.type === "tool-call" || part.type === "tool-result") return true;
      }
    }
    return false;
  }
}
