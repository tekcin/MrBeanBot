/**
 * Message V2 types ported from OpenCode.
 * Rich message format with parts (text, tool, reasoning, snapshot, patch, file).
 */
import z from "zod";
import { BusEvent } from "../bus/bus-event.js";

export namespace MessageV2 {
  export const TextPart = z.object({
    id: z.string(),
    messageID: z.string(),
    sessionID: z.string(),
    type: z.literal("text"),
    text: z.string(),
    time: z
      .object({
        start: z.number(),
        end: z.number().optional(),
      })
      .optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  });
  export type TextPart = z.infer<typeof TextPart>;

  export const ReasoningPart = z.object({
    id: z.string(),
    messageID: z.string(),
    sessionID: z.string(),
    type: z.literal("reasoning"),
    text: z.string(),
    time: z.object({
      start: z.number(),
      end: z.number().optional(),
    }),
    metadata: z.record(z.string(), z.any()).optional(),
  });
  export type ReasoningPart = z.infer<typeof ReasoningPart>;

  export const ToolPartState = z.discriminatedUnion("status", [
    z.object({
      status: z.literal("pending"),
      input: z.record(z.string(), z.any()),
      raw: z.string().optional(),
    }),
    z.object({
      status: z.literal("running"),
      input: z.record(z.string(), z.any()),
      time: z.object({ start: z.number() }),
    }),
    z.object({
      status: z.literal("completed"),
      input: z.record(z.string(), z.any()),
      output: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
      title: z.string().optional(),
      time: z.object({ start: z.number(), end: z.number() }),
      attachments: z.any().optional(),
    }),
    z.object({
      status: z.literal("error"),
      input: z.record(z.string(), z.any()),
      error: z.string(),
      time: z.object({ start: z.number(), end: z.number() }),
    }),
  ]);

  export const ToolPart = z.object({
    id: z.string(),
    messageID: z.string(),
    sessionID: z.string(),
    type: z.literal("tool"),
    tool: z.string(),
    callID: z.string(),
    state: ToolPartState,
    metadata: z.record(z.string(), z.any()).optional(),
  });
  export type ToolPart = z.infer<typeof ToolPart>;

  export const StepStartPart = z.object({
    id: z.string(),
    messageID: z.string(),
    sessionID: z.string(),
    type: z.literal("step-start"),
    snapshot: z.string().optional(),
  });

  export const StepFinishPart = z.object({
    id: z.string(),
    messageID: z.string(),
    sessionID: z.string(),
    type: z.literal("step-finish"),
    reason: z.string().optional(),
    snapshot: z.string().optional(),
    tokens: z.any().optional(),
    cost: z.number().optional(),
  });

  export const PatchPart = z.object({
    id: z.string(),
    messageID: z.string(),
    sessionID: z.string(),
    type: z.literal("patch"),
    hash: z.string(),
    files: z.string().array(),
  });

  export const FilePart = z.object({
    id: z.string(),
    messageID: z.string(),
    sessionID: z.string(),
    type: z.literal("file"),
    mime: z.string(),
    path: z.string(),
    source: z.any().optional(),
  });

  export const Part = z.union([
    TextPart,
    ReasoningPart,
    ToolPart,
    StepStartPart,
    StepFinishPart,
    PatchPart,
    FilePart,
  ]);
  export type Part = z.infer<typeof Part>;

  /** Base message schema shared by User and Assistant */
  const BaseMessage = z.object({
    id: z.string(),
    sessionID: z.string(),
    system: z.string().optional(),
  });

  export const User = BaseMessage.extend({
    role: z.literal("user"),
    variant: z.string().optional(),
    tools: z.record(z.string(), z.boolean()).optional(),
  });
  export type User = z.infer<typeof User>;

  export const Assistant = BaseMessage.extend({
    role: z.literal("assistant"),
    agent: z.string(),
    modelID: z.string(),
    providerID: z.string(),
    parentID: z.string().optional(),
    finish: z.string().optional(),
    cost: z.number(),
    tokens: z.any().optional(),
    error: z
      .object({
        name: z.string(),
        message: z.string(),
      })
      .optional(),
    time: z.object({
      created: z.number(),
      completed: z.number().optional(),
    }),
  });
  export type Assistant = z.infer<typeof Assistant>;

  export const Info = z.union([User, Assistant]);
  export type Info = z.infer<typeof Info>;

  export interface WithParts {
    info: Info;
    parts: Part[];
  }

  export const Event = {
    Updated: BusEvent.define(
      "message.updated",
      z.object({
        info: Info,
      }),
    ),
    Removed: BusEvent.define(
      "message.removed",
      z.object({
        sessionID: z.string(),
        messageID: z.string(),
      }),
    ),
    PartUpdated: BusEvent.define(
      "message.part.updated",
      z.object({
        part: Part,
        delta: z.string().optional(),
      }),
    ),
    PartRemoved: BusEvent.define(
      "message.part.removed",
      z.object({
        sessionID: z.string(),
        messageID: z.string(),
        partID: z.string(),
      }),
    ),
  };

  /**
   * Convert a caught error into a message error shape.
   */
  export function fromError(
    e: unknown,
    _context?: { providerID?: string },
  ): { name: string; message: string } {
    if (e instanceof Error) {
      return {
        name: e.constructor.name || "Error",
        message: e.message,
      };
    }
    return {
      name: "UnknownError",
      message: String(e),
    };
  }
}
