/**
 * Bridge between the in-process Bus event system (OpenCode-style)
 * and the TUI's existing ChatEvent/AgentEvent format.
 *
 * When the TUI runs embedded (same process as the gateway), this bridge
 * subscribes to Bus events and translates them into the gateway WebSocket
 * event format that tui-event-handlers.ts already understands.
 *
 * This allows the TUI to consume new Session/Bus events alongside (or
 * instead of) the gateway WebSocket connection.
 */
import { Bus } from "../bus/index.js";
import { Session } from "../sessions/session.js";
import { MessageV2 } from "../sessions/message-v2.js";
import type { ChatEvent, AgentEvent } from "./tui-types.js";

export type BusBridgeOptions = {
  /** Called when a Bus event is translated into a ChatEvent */
  onChatEvent: (event: ChatEvent) => void;
  /** Called when a Bus event is translated into an AgentEvent */
  onAgentEvent: (event: AgentEvent) => void;
};

/**
 * Start the Bus event bridge. Returns a cleanup function to unsubscribe.
 */
export function startBusEventBridge(opts: BusBridgeOptions): () => void {
  const unsubscribers: Array<() => void> = [];

  // Track active run IDs per session for mapping Bus events to TUI events.
  // Bus events don't have a runId concept (they use sessionID/messageID),
  // so we synthesize one from the assistant messageID.
  const sessionRunMap = new Map<string, string>();

  // --- Text part updates → ChatEvent deltas ---
  unsubscribers.push(
    Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
      const { part, delta } = event.properties;
      const sessionID = part.sessionID;

      if (part.type === "text") {
        const runId = sessionRunMap.get(sessionID) ?? part.messageID;
        sessionRunMap.set(sessionID, runId);

        opts.onChatEvent({
          runId,
          sessionKey: sessionID,
          state: "delta",
          message: {
            role: "assistant",
            content: part.text,
            delta: delta ?? "",
          },
        });
      }

      if (part.type === "reasoning") {
        const runId = sessionRunMap.get(sessionID) ?? part.messageID;
        sessionRunMap.set(sessionID, runId);

        opts.onChatEvent({
          runId,
          sessionKey: sessionID,
          state: "delta",
          message: {
            role: "assistant",
            thinking: part.text,
            content: "",
          },
        });
      }

      if (part.type === "tool") {
        const runId = sessionRunMap.get(sessionID) ?? part.messageID;
        const toolState = part.state;

        if (toolState.status === "pending" || toolState.status === "running") {
          opts.onAgentEvent({
            runId,
            stream: "tool",
            data: {
              phase: toolState.status === "pending" ? "start" : "start",
              toolCallId: part.callID,
              name: part.tool,
              args: toolState.input,
            },
          });
        } else if (toolState.status === "completed") {
          opts.onAgentEvent({
            runId,
            stream: "tool",
            data: {
              phase: "result",
              toolCallId: part.callID,
              name: part.tool,
              result: toolState.output ?? "",
              isError: false,
            },
          });
        } else if (toolState.status === "error") {
          opts.onAgentEvent({
            runId,
            stream: "tool",
            data: {
              phase: "result",
              toolCallId: part.callID,
              name: part.tool,
              result: toolState.error,
              isError: true,
            },
          });
        }
      }

      if (part.type === "step-start") {
        const runId = sessionRunMap.get(sessionID) ?? part.messageID;
        opts.onAgentEvent({
          runId,
          stream: "lifecycle",
          data: { phase: "start" },
        });
      }

      if (part.type === "step-finish") {
        const runId = sessionRunMap.get(sessionID) ?? part.messageID;
        opts.onAgentEvent({
          runId,
          stream: "lifecycle",
          data: { phase: "end" },
        });
      }
    }),
  );

  // --- Session error → ChatEvent error ---
  unsubscribers.push(
    Bus.subscribe(Session.Event.Error, (event) => {
      const sessionID = event.properties.sessionID;
      if (!sessionID) return;
      const runId = sessionRunMap.get(sessionID) ?? sessionID;

      opts.onChatEvent({
        runId,
        sessionKey: sessionID,
        state: "error",
        errorMessage: event.properties.error.message,
      });

      sessionRunMap.delete(sessionID);
    }),
  );

  // --- Session updated → could indicate completion ---
  // We don't emit a "final" event here because the processor handles
  // finalization through PartUpdated events. The TUI will see the last
  // delta and then the step-finish lifecycle event.

  return () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
    sessionRunMap.clear();
  };
}
