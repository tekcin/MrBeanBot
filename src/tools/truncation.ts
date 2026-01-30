/**
 * Output truncation module ported from OpenCode.
 * Handles large tool outputs by saving full content to disk
 * and providing truncated previews with hints.
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Identifier } from "../id/id.js";
import { PermissionNext } from "../permission/next.js";
import type { AgentDef } from "../agents/agent-definitions.js";

export namespace Truncate {
  export const MAX_LINES = 2000;
  export const MAX_BYTES = 50 * 1024;

  /** Directory for full truncated outputs. */
  const DATA_DIR = path.join(os.homedir(), ".mrbeanbot", "data");
  export const DIR = path.join(DATA_DIR, "tool-output");

  const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  export type Result =
    | { content: string; truncated: false }
    | { content: string; truncated: true; outputPath: string };

  export interface Options {
    maxLines?: number;
    maxBytes?: number;
    direction?: "head" | "tail";
  }

  /**
   * Periodically clean up old truncated output files.
   * Call this from a scheduler or on startup.
   */
  export async function cleanup(): Promise<void> {
    try {
      const entries = await fs.readdir(DIR).catch(() => [] as string[]);
      const cutoff = Date.now() - RETENTION_MS;
      for (const entry of entries) {
        if (!entry.startsWith("tool_")) continue;
        const ts = Identifier.timestamp(entry);
        if (ts >= cutoff) continue;
        await fs.unlink(path.join(DIR, entry)).catch(() => {});
      }
    } catch {
      // Directory might not exist yet
    }
  }

  function hasTaskTool(agent?: AgentDef.Info): boolean {
    if (!agent?.permission) return false;
    const rule = PermissionNext.evaluate("task", "*", agent.permission);
    return rule.action !== "deny";
  }

  /**
   * Truncate tool output if it exceeds size limits.
   * Full output is saved to disk with a generated path.
   */
  export async function output(
    text: string,
    options: Options = {},
    agent?: AgentDef.Info,
  ): Promise<Result> {
    const maxLines = options.maxLines ?? MAX_LINES;
    const maxBytes = options.maxBytes ?? MAX_BYTES;
    const direction = options.direction ?? "head";
    const lines = text.split("\n");
    const totalBytes = Buffer.byteLength(text, "utf-8");

    if (lines.length <= maxLines && totalBytes <= maxBytes) {
      return { content: text, truncated: false };
    }

    const out: string[] = [];
    let bytes = 0;
    let hitBytes = false;

    if (direction === "head") {
      for (let i = 0; i < lines.length && i < maxLines; i++) {
        const size = Buffer.byteLength(lines[i], "utf-8") + (i > 0 ? 1 : 0);
        if (bytes + size > maxBytes) {
          hitBytes = true;
          break;
        }
        out.push(lines[i]);
        bytes += size;
      }
    } else {
      for (let i = lines.length - 1; i >= 0 && out.length < maxLines; i--) {
        const size = Buffer.byteLength(lines[i], "utf-8") + (out.length > 0 ? 1 : 0);
        if (bytes + size > maxBytes) {
          hitBytes = true;
          break;
        }
        out.unshift(lines[i]);
        bytes += size;
      }
    }

    const removed = hitBytes ? totalBytes - bytes : lines.length - out.length;
    const unit = hitBytes ? "bytes" : "lines";
    const preview = out.join("\n");

    // Save full output to disk
    const id = Identifier.ascending("tool");
    await fs.mkdir(DIR, { recursive: true });
    const filepath = path.join(DIR, id);
    await fs.writeFile(filepath, text, "utf-8");

    const hint = hasTaskTool(agent)
      ? `The tool call succeeded but the output was truncated. Full output saved to: ${filepath}\nUse the Task tool to delegate file exploration. Do NOT read the full file yourself - delegate to save context.`
      : `The tool call succeeded but the output was truncated. Full output saved to: ${filepath}\nUse Grep to search the full content or Read with offset/limit to view specific sections.`;
    const message =
      direction === "head"
        ? `${preview}\n\n...${removed} ${unit} truncated...\n\n${hint}`
        : `...${removed} ${unit} truncated...\n\n${hint}\n\n${preview}`;

    return { content: message, truncated: true, outputPath: filepath };
  }
}
