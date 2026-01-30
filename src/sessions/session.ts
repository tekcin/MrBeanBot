/**
 * Session management module ported from OpenCode.
 * Manages session lifecycle, messages, and the chat() entry point.
 */
import z from "zod";
import { BusEvent } from "../bus/bus-event.js";
import { Bus } from "../bus/index.js";
import { Identifier } from "../id/id.js";
import { Storage } from "../storage/storage.js";
import { MessageV2 } from "./message-v2.js";
import { SessionProcessor } from "./processor.js";
import { LLM } from "./llm.js";
import { Provider } from "../providers/provider.js";
import { AgentDef } from "../agents/agent-definitions.js";
import type { CoreMessage, Tool } from "ai";

export namespace Session {
  export const Info = z
    .object({
      id: z.string(),
      title: z.string(),
      projectID: z.string().optional(),
      directory: z.string().optional(),
      parentID: z.string().optional(),
      version: z.string().optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
        compacting: z.number().optional(),
      }),
    })
    .meta({ ref: "Session" });
  export type Info = z.infer<typeof Info>;

  export const Event = {
    Created: BusEvent.define("session.created", z.object({ info: Info })),
    Updated: BusEvent.define("session.updated", z.object({ info: Info })),
    Deleted: BusEvent.define("session.deleted", z.object({ info: Info })),
    Error: BusEvent.define(
      "session.error",
      z.object({
        sessionID: z.string().optional(),
        error: z.object({ name: z.string(), message: z.string() }),
      }),
    ),
  };

  // Active sessions (in-memory state for running sessions)
  const activeSessions = new Map<string, AbortController>();

  export async function create(input?: { title?: string; parentID?: string }): Promise<Info> {
    const now = Date.now();
    const session: Info = {
      id: Identifier.descending("session"),
      title: input?.title ?? `New session - ${new Date(now).toISOString()}`,
      parentID: input?.parentID,
      time: {
        created: now,
        updated: now,
      },
    };
    await Storage.write(["session", session.id], session);
    void Bus.publish(Event.Created, { info: session });
    return session;
  }

  export async function get(sessionID: string): Promise<Info> {
    return Storage.read<Info>(["session", sessionID]);
  }

  export async function update(sessionID: string, editor: (draft: Info) => void): Promise<Info> {
    const result = await Storage.update<Info>(["session", sessionID], (draft) => {
      editor(draft);
      draft.time.updated = Date.now();
    });
    void Bus.publish(Event.Updated, { info: result });
    return result;
  }

  export async function remove(sessionID: string): Promise<void> {
    try {
      const session = await get(sessionID);
      await Storage.remove(["session", sessionID]);
      void Bus.publish(Event.Deleted, { info: session });
    } catch {
      // Session not found, ignore
    }
  }

  export async function list(): Promise<Info[]> {
    const keys = await Storage.list(["session"]);
    const sessions: Info[] = [];
    for (const key of keys) {
      try {
        sessions.push(await Storage.read<Info>(key));
      } catch {
        // Corrupted session, skip
      }
    }
    return sessions;
  }

  /**
   * Main chat entry point.
   * This is called from gateway/server-chat.ts to start an agent conversation.
   * Replaces the old runEmbeddedPiAgent() call.
   */
  export async function chat(input: {
    sessionID: string;
    message: string;
    agentName?: string;
    modelOverride?: { providerID: string; modelID: string };
    system?: string[];
    tools?: Record<string, Tool>;
    abort?: AbortSignal;
  }): Promise<{
    text: string;
    error?: { name: string; message: string };
    tokens?: { input: number; output: number };
  }> {
    const abortController = new AbortController();
    const abort = input.abort ?? abortController.signal;

    // Register active session
    activeSessions.set(input.sessionID, abortController);

    // Subscribe to Bus events to collect the final text
    let accumulatedText = "";
    const unsubText = Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
      const { part } = event.properties as { part: MessageV2.Part; delta?: string };
      if (part.type === "text" && part.sessionID === input.sessionID) {
        accumulatedText = part.text;
      }
    });

    try {
      // Resolve agent
      const agentName = input.agentName ?? AgentDef.defaultAgent();
      const agent = AgentDef.get(agentName);
      if (!agent) throw new Error(`Agent "${agentName}" not found`);

      // Resolve model
      const modelRef = input.modelOverride ?? agent.model ?? (await Provider.defaultModel());
      const model = await Provider.getModel(modelRef.providerID, modelRef.modelID);

      // Create user message
      const userMessageID = Identifier.ascending("message");
      const userMessage: MessageV2.User = {
        id: userMessageID,
        sessionID: input.sessionID,
        role: "user",
      };

      // Create assistant message
      const assistantMessage: MessageV2.Assistant = {
        id: Identifier.ascending("message"),
        sessionID: input.sessionID,
        role: "assistant",
        agent: agentName,
        modelID: model.id,
        providerID: model.providerID,
        parentID: userMessageID,
        cost: 0,
        time: {
          created: Date.now(),
        },
      };

      // Build messages for LLM
      const messages: CoreMessage[] = [
        {
          role: "user",
          content: input.message,
        },
      ];

      // Create processor
      const processor = SessionProcessor.create({
        assistantMessage,
        sessionID: input.sessionID,
        model,
        abort,
      });

      // Build stream input
      const streamInput: LLM.StreamInput = {
        user: userMessage,
        sessionID: input.sessionID,
        model,
        agent,
        system: input.system ?? [],
        abort,
        messages,
        tools: input.tools ?? {},
      };

      // Process the stream
      await processor.process(streamInput);

      return {
        text: accumulatedText,
        error: assistantMessage.error,
        tokens: assistantMessage.tokens,
      };
    } finally {
      unsubText();
      activeSessions.delete(input.sessionID);
    }
  }

  /**
   * Abort an active session.
   */
  export function abort(sessionID: string): boolean {
    const controller = activeSessions.get(sessionID);
    if (!controller) return false;
    controller.abort();
    activeSessions.delete(sessionID);
    return true;
  }

  export class BusyError extends Error {
    constructor(public readonly sessionID: string) {
      super(`Session ${sessionID} is busy`);
    }
  }
}
