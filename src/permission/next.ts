import { Bus } from "../bus/index.js";
import { BusEvent } from "../bus/bus-event.js";
import { Identifier } from "../id/id.js";
import { Storage } from "../storage/storage.js";
import { Wildcard } from "../utils/wildcard.js";
import { fn } from "../utils/fn.js";
import os from "os";
import z from "zod";
import type { PermissionConfig } from "./types.js";

export namespace PermissionNext {
  function expand(pattern: string): string {
    if (pattern.startsWith("~/")) return os.homedir() + pattern.slice(1);
    if (pattern === "~") return os.homedir();
    if (pattern.startsWith("$HOME/")) return os.homedir() + pattern.slice(5);
    if (pattern.startsWith("$HOME")) return os.homedir() + pattern.slice(5);
    return pattern;
  }

  export const Action = z.enum(["allow", "deny", "ask"]).meta({
    ref: "PermissionAction",
  });
  export type Action = z.infer<typeof Action>;

  export const Rule = z
    .object({
      permission: z.string(),
      pattern: z.string(),
      action: Action,
    })
    .meta({
      ref: "PermissionRule",
    });
  export type Rule = z.infer<typeof Rule>;

  export const Ruleset = Rule.array().meta({
    ref: "PermissionRuleset",
  });
  export type Ruleset = z.infer<typeof Ruleset>;

  export function fromConfig(permission: PermissionConfig): Ruleset {
    const ruleset: Ruleset = [];
    for (const [key, value] of Object.entries(permission)) {
      if (typeof value === "string") {
        ruleset.push({
          permission: key,
          action: value as Action,
          pattern: "*",
        });
        continue;
      }
      ruleset.push(
        ...Object.entries(value).map(([pattern, action]) => ({
          permission: key,
          pattern: expand(pattern),
          action: action as Action,
        })),
      );
    }
    return ruleset;
  }

  export function merge(...rulesets: Ruleset[]): Ruleset {
    return rulesets.flat();
  }

  export const Request = z
    .object({
      id: Identifier.schema("permission"),
      sessionID: Identifier.schema("session"),
      permission: z.string(),
      patterns: z.string().array(),
      metadata: z.record(z.string(), z.any()),
      always: z.string().array(),
      tool: z
        .object({
          messageID: z.string(),
          callID: z.string(),
        })
        .optional(),
    })
    .meta({
      ref: "PermissionRequest",
    });

  export type Request = z.infer<typeof Request>;

  export const Reply = z.enum(["once", "always", "reject"]);
  export type Reply = z.infer<typeof Reply>;

  export const Approval = z.object({
    projectID: z.string(),
    patterns: z.string().array(),
  });

  export const Event = {
    Asked: BusEvent.define("permission.asked", Request),
    Replied: BusEvent.define(
      "permission.replied",
      z.object({
        sessionID: z.string(),
        requestID: z.string(),
        reply: Reply,
      }),
    ),
  };

  // In-memory state for pending permission requests
  const pending: Record<
    string,
    {
      info: Request;
      resolve: () => void;
      reject: (e: any) => void;
    }
  > = {};

  let approved: Ruleset = [];

  export async function initApproved(projectID: string) {
    try {
      approved = await Storage.read<Ruleset>(["permission", projectID]);
    } catch {
      approved = [];
    }
  }

  export const ask = fn(
    Request.partial({ id: true }).extend({
      ruleset: Ruleset,
    }),
    async (input) => {
      const { ruleset, ...request } = input;
      for (const pattern of request.patterns ?? []) {
        const rule = evaluate(request.permission, pattern, ruleset, approved);
        if (rule.action === "deny")
          throw new DeniedError(
            ruleset.filter((r) => Wildcard.match(request.permission, r.permission)),
          );
        if (rule.action === "ask") {
          const id = input.id ?? Identifier.ascending("permission");
          return new Promise<void>((resolve, reject) => {
            const info: Request = {
              id,
              ...request,
            };
            pending[id] = {
              info,
              resolve,
              reject,
            };
            void Bus.publish(Event.Asked, info);
          });
        }
        if (rule.action === "allow") continue;
      }
    },
  );

  export const reply = fn(
    z.object({
      requestID: Identifier.schema("permission"),
      reply: Reply,
      message: z.string().optional(),
    }),
    async (input) => {
      const existing = pending[input.requestID];
      if (!existing) return;
      delete pending[input.requestID];
      void Bus.publish(Event.Replied, {
        sessionID: existing.info.sessionID,
        requestID: existing.info.id,
        reply: input.reply,
      });
      if (input.reply === "reject") {
        existing.reject(input.message ? new CorrectedError(input.message) : new RejectedError());
        // Reject all other pending permissions for this session
        const sessionID = existing.info.sessionID;
        for (const [id, p] of Object.entries(pending)) {
          if (p.info.sessionID === sessionID) {
            delete pending[id];
            void Bus.publish(Event.Replied, {
              sessionID: p.info.sessionID,
              requestID: p.info.id,
              reply: "reject",
            });
            p.reject(new RejectedError());
          }
        }
        return;
      }
      if (input.reply === "once") {
        existing.resolve();
        return;
      }
      if (input.reply === "always") {
        for (const pattern of existing.info.always) {
          approved.push({
            permission: existing.info.permission,
            pattern,
            action: "allow",
          });
        }

        existing.resolve();

        const sessionID = existing.info.sessionID;
        for (const [id, p] of Object.entries(pending)) {
          if (p.info.sessionID !== sessionID) continue;
          const ok = p.info.patterns.every(
            (pattern) => evaluate(p.info.permission, pattern, approved).action === "allow",
          );
          if (!ok) continue;
          delete pending[id];
          void Bus.publish(Event.Replied, {
            sessionID: p.info.sessionID,
            requestID: p.info.id,
            reply: "always",
          });
          p.resolve();
        }
        return;
      }
    },
  );

  export function evaluate(permission: string, pattern: string, ...rulesets: Ruleset[]): Rule {
    const merged = merge(...rulesets);
    const match = [...merged]
      .reverse()
      .find(
        (rule: Rule) =>
          Wildcard.match(permission, rule.permission) && Wildcard.match(pattern, rule.pattern),
      );
    return match ?? { action: "ask", permission, pattern: "*" };
  }

  const EDIT_TOOLS = ["edit", "write", "patch", "multiedit"];

  export function disabled(tools: string[], ruleset: Ruleset): Set<string> {
    const result = new Set<string>();
    for (const tool of tools) {
      const permission = EDIT_TOOLS.includes(tool) ? "edit" : tool;
      const rule = [...ruleset]
        .reverse()
        .find((r: Rule) => Wildcard.match(permission, r.permission));
      if (!rule) continue;
      if (rule.pattern === "*" && rule.action === "deny") result.add(tool);
    }
    return result;
  }

  /** User rejected without message - halts execution */
  export class RejectedError extends Error {
    constructor() {
      super(`The user rejected permission to use this specific tool call.`);
    }
  }

  /** User rejected with message - continues with guidance */
  export class CorrectedError extends Error {
    constructor(message: string) {
      super(
        `The user rejected permission to use this specific tool call with the following feedback: ${message}`,
      );
    }
  }

  /** Auto-rejected by config rule - halts execution */
  export class DeniedError extends Error {
    constructor(public readonly ruleset: Ruleset) {
      super(
        `The user has specified a rule which prevents you from using this specific tool call. Here are some of the relevant rules ${JSON.stringify(ruleset)}`,
      );
    }
  }

  export async function list() {
    return Object.values(pending).map((x) => x.info);
  }
}
