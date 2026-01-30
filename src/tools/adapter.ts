/**
 * Adapter that converts MrBeanBot's Tool.Info format into Vercel AI SDK Tool format.
 * This bridges the OpenCode-style tool definitions with the `ai` package's expectations.
 */
import { tool as aiTool, type Tool as AiTool } from "ai";
import { Tool } from "./tool.js";
import { ToolRegistry } from "./registry.js";
import { PermissionNext } from "../permission/next.js";
import { Bus } from "../bus/index.js";
import { MessageV2 } from "../sessions/message-v2.js";
import { Identifier } from "../id/id.js";
import type { AgentDef } from "../agents/agent-definitions.js";

/**
 * Convert all registered tools into Vercel AI SDK format
 * for use with `streamText()`.
 */
export async function resolveAiTools(input: {
  model: { providerID: string; modelID: string };
  agent?: AgentDef.Info;
  sessionID: string;
  messageID: string;
  abort: AbortSignal;
}): Promise<Record<string, AiTool>> {
  const tools = await ToolRegistry.tools(input.model, input.agent);
  const result: Record<string, AiTool> = {};

  for (const t of tools) {
    result[t.id] = aiTool<Record<string, unknown>, Record<string, unknown>>({
      description: t.description,
      // Vercel AI SDK v5 uses inputSchema instead of parameters
      inputSchema: t.parameters as any,
      execute: async (args: Record<string, unknown>) => {
        const callID = Identifier.ascending("tool");
        const ctx: Tool.Context = {
          sessionID: input.sessionID,
          messageID: input.messageID,
          agent: input.agent?.name ?? "build",
          abort: input.abort,
          callID,
          metadata(update) {
            if (update.title || update.metadata) {
              void Bus.publish(MessageV2.Event.PartUpdated, {
                part: {
                  id: Identifier.ascending("part"),
                  messageID: input.messageID,
                  sessionID: input.sessionID,
                  type: "tool" as const,
                  tool: t.id,
                  callID,
                  state: {
                    status: "running" as const,
                    input: args as Record<string, unknown>,
                    time: { start: Date.now() },
                  },
                },
              });
            }
          },
          async ask(request) {
            if (!input.agent?.permission) return;
            await PermissionNext.ask({
              ...request,
              sessionID: input.sessionID,
              ruleset: input.agent.permission,
            });
          },
        };

        const execResult = await t.execute(args, ctx);
        return {
          output: execResult.output,
          title: execResult.title,
          metadata: execResult.metadata,
        };
      },
    });
  }

  return result;
}
