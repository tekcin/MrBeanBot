/**
 * Glob tool ported from OpenCode.
 * Finds files matching glob patterns, sorted by modification time.
 */
import z from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { Tool } from "../tool.js";

const DESCRIPTION = `Fast file pattern matching tool.
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool to find files by name patterns`;

const RESULT_LIMIT = 100;

export const GlobTool = Tool.define("glob", {
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe("The glob pattern to match files against"),
    path: z
      .string()
      .optional()
      .describe("The directory to search in. Defaults to current working directory."),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "glob",
      patterns: [params.pattern],
      always: ["*"],
      metadata: {
        pattern: params.pattern,
        path: params.path,
      },
    });

    let search = params.path ?? process.cwd();
    search = path.isAbsolute(search) ? search : path.resolve(process.cwd(), search);

    // Use Node.js glob (available in Node 22+)
    const { glob } = await import("node:fs/promises");
    const files: Array<{ path: string; mtime: number }> = [];
    let truncated = false;

    try {
      for await (const entry of glob(params.pattern, { cwd: search })) {
        if (files.length >= RESULT_LIMIT) {
          truncated = true;
          break;
        }
        const full = path.resolve(search, entry);
        const stat = await fs.stat(full).catch(() => null);
        files.push({
          path: full,
          mtime: stat?.mtime.getTime() ?? 0,
        });
      }
    } catch {
      // If Node glob isn't available, fall back to readdir
      await walkDir(search, params.pattern, files, RESULT_LIMIT);
      truncated = files.length >= RESULT_LIMIT;
    }

    files.sort((a, b) => b.mtime - a.mtime);

    const output: string[] = [];
    if (files.length === 0) {
      output.push("No files found");
    } else {
      output.push(...files.map((f) => f.path));
      if (truncated) {
        output.push("");
        output.push("(Results are truncated. Consider using a more specific path or pattern.)");
      }
    }

    return {
      title: path.relative(process.cwd(), search) || ".",
      metadata: {
        count: files.length,
        truncated,
      },
      output: output.join("\n"),
    };
  },
});

/** Simple recursive walk as fallback when fs.glob isn't available. */
async function walkDir(
  dir: string,
  pattern: string,
  files: Array<{ path: string; mtime: number }>,
  limit: number,
): Promise<void> {
  if (files.length >= limit) return;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= limit) break;
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkDir(full, pattern, files, limit);
      } else if (matchSimpleGlob(entry.name, pattern)) {
        const stat = await fs.stat(full).catch(() => null);
        files.push({ path: full, mtime: stat?.mtime.getTime() ?? 0 });
      }
    }
  } catch {
    // Permission denied or other error
  }
}

/** Very basic glob matching for fallback. */
function matchSimpleGlob(name: string, pattern: string): boolean {
  // Extract the file-level pattern (last segment)
  const filePattern = pattern.split("/").pop() ?? pattern;
  if (filePattern === "*") return true;
  if (filePattern.startsWith("*.")) {
    return name.endsWith(filePattern.slice(1));
  }
  return name === filePattern;
}
