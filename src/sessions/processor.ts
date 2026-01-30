/**
 * Session Processor ported from OpenCode.
 * Main streaming loop that processes LLM responses,
 * handles tool calls, reasoning, text, and doom-loop detection.
 */
import z from "zod";
import { BusEvent } from "../bus/bus-event.js";
import { MessageV2 } from "./message-v2.js";
import { Identifier } from "../id/id.js";
import { Bus } from "../bus/index.js";
import { PermissionNext } from "../permission/next.js";
import { LLM } from "./llm.js";
import { AgentDef } from "../agents/agent-definitions.js";
import type { Provider } from "../providers/provider.js";

export namespace SessionProcessor {
  const DOOM_LOOP_THRESHOLD = 3;

  export type Info = Awaited<ReturnType<typeof create>>;
  export type Result = "continue" | "compact" | "stop";

  export function create(input: {
    assistantMessage: MessageV2.Assistant;
    sessionID: string;
    model: Provider.Model;
    abort: AbortSignal;
  }) {
    const toolcalls: Record<string, MessageV2.ToolPart> = {};
    let blocked = false;
    let attempt = 0;
    let needsCompaction = false;

    const result = {
      get message() {
        return input.assistantMessage;
      },
      partFromToolCall(toolCallID: string) {
        return toolcalls[toolCallID];
      },
      async process(streamInput: LLM.StreamInput): Promise<Result> {
        needsCompaction = false;

        while (true) {
          try {
            let currentText: MessageV2.TextPart | undefined;
            const reasoningMap: Record<string, MessageV2.ReasoningPart> = {};
            const stream = await LLM.stream(streamInput);

            // Process stream events using ai v5 event types.
            // Events are cast to a loose type since ai v5's fullStream union
            // depends on the tool set (which resolves differently at compile time).
            for await (const rawValue of stream.fullStream) {
              input.abort.throwIfAborted();

              const value = rawValue as { type: string; [key: string]: unknown };

              switch (value.type) {
                case "start-step":
                case "step-start":
                  break;

                case "reasoning-delta":
                case "reasoning": {
                  // ai v5: reasoning-delta events use "text" property
                  const delta = (value["text"] as string) ?? (value["textDelta"] as string) ?? "";
                  const reasoningId = (value["id"] as string) ?? "default";
                  if (!(reasoningId in reasoningMap)) {
                    reasoningMap[reasoningId] = {
                      id: Identifier.ascending("part"),
                      messageID: input.assistantMessage.id,
                      sessionID: input.assistantMessage.sessionID,
                      type: "reasoning",
                      text: "",
                      time: { start: Date.now() },
                    };
                  }
                  const part = reasoningMap[reasoningId];
                  part.text += delta;
                  if (part.text) {
                    void Bus.publish(MessageV2.Event.PartUpdated, { part, delta });
                  }
                  break;
                }

                case "tool-call-streaming-start": {
                  const toolCallId = value["toolCallId"] as string;
                  const toolName = value["toolName"] as string;
                  const toolPart: MessageV2.ToolPart = {
                    id: toolcalls[toolCallId]?.id ?? Identifier.ascending("part"),
                    messageID: input.assistantMessage.id,
                    sessionID: input.assistantMessage.sessionID,
                    type: "tool",
                    tool: toolName,
                    callID: toolCallId,
                    state: {
                      status: "pending",
                      input: {},
                      raw: "",
                    },
                  };
                  toolcalls[toolCallId] = toolPart;
                  void Bus.publish(MessageV2.Event.PartUpdated, { part: toolPart });
                  break;
                }

                case "tool-call-delta":
                  break;

                case "tool-call": {
                  const toolCallId = (value["toolCallId"] as string) ?? "";
                  const toolName = (value["toolName"] as string) ?? "";
                  const args = (value["args"] as Record<string, unknown>) ?? {};
                  const match = toolcalls[toolCallId];
                  if (match) {
                    match.tool = toolName;
                    match.state = {
                      status: "running",
                      input: args,
                      time: { start: Date.now() },
                    };
                    toolcalls[toolCallId] = match;
                    void Bus.publish(MessageV2.Event.PartUpdated, { part: match });

                    // Doom-loop detection
                    const recentTools = Object.values(toolcalls).slice(-DOOM_LOOP_THRESHOLD);
                    if (
                      recentTools.length === DOOM_LOOP_THRESHOLD &&
                      recentTools.every(
                        (p) =>
                          p.tool === toolName &&
                          p.state.status !== "pending" &&
                          JSON.stringify(p.state.input) === JSON.stringify(args),
                      )
                    ) {
                      const agent = AgentDef.get(input.assistantMessage.agent);
                      if (agent) {
                        await PermissionNext.ask({
                          permission: "doom_loop",
                          patterns: [toolName],
                          sessionID: input.assistantMessage.sessionID,
                          metadata: {
                            tool: toolName,
                            input: args,
                          },
                          always: [toolName],
                          ruleset: agent.permission,
                        });
                      }
                    }
                  }
                  break;
                }

                case "tool-result": {
                  const toolCallId = (value["toolCallId"] as string) ?? "";
                  const result = value["result"];
                  const match = toolcalls[toolCallId];
                  if (match && match.state.status === "running") {
                    match.state = {
                      status: "completed",
                      input: match.state.input,
                      output: result != null ? JSON.stringify(result) : undefined,
                      time: {
                        start: match.state.time.start,
                        end: Date.now(),
                      },
                    };
                    void Bus.publish(MessageV2.Event.PartUpdated, { part: match });
                    delete toolcalls[toolCallId];
                  }
                  break;
                }

                case "error":
                  throw value["error"];

                case "finish-step":
                case "step-finish": {
                  const usage = value["usage"] as
                    | { promptTokens?: number; completionTokens?: number }
                    | undefined;
                  input.assistantMessage.finish = value["finishReason"] as string;
                  input.assistantMessage.tokens = {
                    input: usage?.promptTokens ?? 0,
                    output: usage?.completionTokens ?? 0,
                  };
                  break;
                }

                case "text-delta": {
                  // ai v5: text-delta events use "text" property (not "textDelta")
                  const delta = (value["text"] as string) ?? (value["textDelta"] as string) ?? "";
                  if (!currentText) {
                    currentText = {
                      id: Identifier.ascending("part"),
                      messageID: input.assistantMessage.id,
                      sessionID: input.assistantMessage.sessionID,
                      type: "text",
                      text: "",
                      time: { start: Date.now() },
                    };
                  }
                  currentText.text += delta;
                  if (currentText.text) {
                    void Bus.publish(MessageV2.Event.PartUpdated, {
                      part: currentText,
                      delta,
                    });
                  }
                  break;
                }

                case "reasoning-start":
                case "reasoning-end":
                case "text-start":
                case "text-end":
                  break;

                case "finish":
                  // Finalize current text part if any
                  if (currentText) {
                    currentText.text = currentText.text.trimEnd();
                    currentText.time = {
                      start: currentText.time?.start ?? Date.now(),
                      end: Date.now(),
                    };
                    void Bus.publish(MessageV2.Event.PartUpdated, { part: currentText });
                  }
                  currentText = undefined;
                  // Finalize reasoning parts
                  for (const [id, rPart] of Object.entries(reasoningMap)) {
                    rPart.text = rPart.text.trimEnd();
                    rPart.time = { ...rPart.time, end: Date.now() };
                    void Bus.publish(MessageV2.Event.PartUpdated, { part: rPart });
                    delete reasoningMap[id];
                  }
                  break;

                default:
                  continue;
              }

              if (needsCompaction) break;
            }
          } catch (e: any) {
            const error = MessageV2.fromError(e, { providerID: input.model.providerID });

            // Simple retry logic for transient errors
            if (isRetryable(e) && attempt < 3) {
              attempt++;
              const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
              await sleep(delay, input.abort).catch(() => {});
              continue;
            }

            input.assistantMessage.error = error;
            void Bus.publish(SessionEvent.Error, {
              sessionID: input.assistantMessage.sessionID,
              error: input.assistantMessage.error,
            });
          }

          // Clean up any in-progress tool calls
          for (const [_id, tc] of Object.entries(toolcalls)) {
            if (tc.state.status !== "completed" && tc.state.status !== "error") {
              tc.state = {
                status: "error",
                input: tc.state.input,
                error: "Tool execution aborted",
                time: { start: Date.now(), end: Date.now() },
              };
              void Bus.publish(MessageV2.Event.PartUpdated, { part: tc });
            }
          }

          input.assistantMessage.time.completed = Date.now();

          if (needsCompaction) return "compact";
          if (blocked) return "stop";
          if (input.assistantMessage.error) return "stop";
          return "continue";
        }
      },
    };
    return result;
  }

  function isRetryable(e: unknown): boolean {
    if (!(e instanceof Error)) return false;
    const msg = e.message.toLowerCase();
    return (
      msg.includes("rate limit") ||
      msg.includes("overloaded") ||
      msg.includes("529") ||
      msg.includes("503") ||
      msg.includes("timeout")
    );
  }

  function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new Error("Aborted"));
        },
        { once: true },
      );
    });
  }
}

const SessionEvent = {
  Error: BusEvent.define(
    "session.error",
    z.object({
      sessionID: z.string().optional(),
      error: z.object({
        name: z.string(),
        message: z.string(),
      }),
    }),
  ),
};
