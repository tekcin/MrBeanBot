/**
 * Tool Registry ported from OpenCode.
 * Manages built-in tools, custom tools (from config dirs), and plugin tools.
 * Provides initialization and filtering for model/agent-specific tool sets.
 */
import z from "zod";
import path from "node:path";
import { Tool } from "./tool.js";
import { Truncate } from "./truncation.js";
import type { AgentDef } from "../agents/agent-definitions.js";

/**
 * Plugin-provided tool definition (simplified format).
 * Used by both OpenCode-style hooks and MrBeanBot manifest plugins.
 */
export interface ToolDefinition {
  description: string;
  args: Record<string, z.ZodTypeAny>;
  execute(args: Record<string, unknown>, ctx: Tool.Context): Promise<string>;
}

export namespace ToolRegistry {
  /** Custom tools loaded from config dirs and plugins. */
  const custom: Tool.Info[] = [];
  let _initialized = false;

  /** Convert a plugin-provided tool definition into Tool.Info. */
  function fromPlugin(id: string, def: ToolDefinition): Tool.Info {
    return {
      id,
      init: async (initCtx) => ({
        parameters: z.object(def.args),
        description: def.description,
        execute: async (args: Record<string, unknown>, ctx) => {
          const result = await def.execute(args, ctx);
          const out = await Truncate.output(result, {}, initCtx?.agent);
          return {
            title: "",
            output: out.truncated ? out.content : result,
            metadata: {
              truncated: out.truncated,
              outputPath: out.truncated ? (out as { outputPath: string }).outputPath : undefined,
            },
          };
        },
      }),
    };
  }

  /**
   * Register a new tool (or replace an existing one with the same ID).
   */
  export function register(tool: Tool.Info): void {
    const idx = custom.findIndex((t) => t.id === tool.id);
    if (idx >= 0) {
      custom.splice(idx, 1, tool);
      return;
    }
    custom.push(tool);
  }

  /**
   * Register a tool from a plugin definition.
   */
  export function registerPlugin(id: string, def: ToolDefinition): void {
    register(fromPlugin(id, def));
  }

  /**
   * Load custom tools from config directories.
   * Scans for `{tool,tools}/*.{js,ts}` in each config dir.
   */
  export async function loadCustomTools(configDirs: string[]): Promise<void> {
    for (const dir of configDirs) {
      const toolDirs = [path.join(dir, "tool"), path.join(dir, "tools")];
      for (const toolDir of toolDirs) {
        try {
          const { readdir } = await import("node:fs/promises");
          const entries = await readdir(toolDir).catch(() => [] as string[]);
          for (const entry of entries) {
            if (!entry.endsWith(".ts") && !entry.endsWith(".js")) continue;
            const namespace = path.basename(entry, path.extname(entry));
            try {
              const mod = await import(path.join(toolDir, entry));
              for (const [id, def] of Object.entries<ToolDefinition>(mod)) {
                register(fromPlugin(id === "default" ? namespace : `${namespace}_${id}`, def));
              }
            } catch {
              // Invalid tool file, skip
            }
          }
        } catch {
          // Directory doesn't exist, skip
        }
      }
    }
    _initialized = true;
  }

  /**
   * Get all registered built-in + custom tools.
   * Built-in tools are lazily imported to avoid circular dependencies.
   */
  async function all(): Promise<Tool.Info[]> {
    // Lazy-import built-in tools to avoid circular deps at module load time
    const builtins = await import("./builtin/index.js");

    return [
      builtins.InvalidTool,
      builtins.BashTool,
      builtins.ReadTool,
      builtins.GlobTool,
      builtins.GrepTool,
      builtins.EditTool,
      builtins.WriteTool,
      builtins.WebFetchTool,
      builtins.WebSearchTool,
      ...custom,
    ];
  }

  /**
   * Initialize and filter tools for a specific model and agent.
   * Returns fully initialized tool definitions ready for the Vercel AI SDK.
   */
  export async function tools(
    model: { providerID: string; modelID: string },
    agent?: AgentDef.Info,
  ): Promise<
    Array<{
      id: string;
      description: string;
      parameters: z.ZodType;
      execute: (
        args: unknown,
        ctx: Tool.Context,
      ) => Promise<{
        title: string;
        metadata: Record<string, unknown>;
        output: string;
      }>;
    }>
  > {
    const allTools = await all();

    // Filter tools based on model compatibility
    const filtered = allTools.filter((t) => {
      // GPT models use apply_patch instead of edit/write
      const usePatch =
        model.modelID.includes("gpt-") &&
        !model.modelID.includes("oss") &&
        !model.modelID.includes("gpt-4");
      if (t.id === "apply_patch") return usePatch;
      if (t.id === "edit" || t.id === "write") return !usePatch;
      return true;
    });

    // Initialize all tools
    const result = await Promise.all(
      filtered.map(async (t) => {
        const initialized = await t.init({ agent });
        return {
          id: t.id,
          ...initialized,
        };
      }),
    );

    return result;
  }
}
