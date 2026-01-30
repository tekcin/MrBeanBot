/**
 * Grep tool ported from OpenCode.
 * Searches file contents using ripgrep (falls back to Node.js regex search).
 */
import z from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Tool } from "../tool.js";

const execFileAsync = promisify(execFile);

const MAX_LINE_LENGTH = 2000;
const RESULT_LIMIT = 100;

const DESCRIPTION = `Searches file contents using regex patterns.
- Supports full regex syntax
- Filter files with include parameter (e.g. "*.js", "*.{ts,tsx}")
- Results sorted by file modification time
- Uses ripgrep if available, falls back to built-in search`;

export const GrepTool = Tool.define("grep", {
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe("The regex pattern to search for in file contents"),
    path: z
      .string()
      .optional()
      .describe("The directory to search in. Defaults to current working directory."),
    include: z
      .string()
      .optional()
      .describe('File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")'),
  }),
  async execute(params, ctx) {
    if (!params.pattern) {
      throw new Error("pattern is required");
    }

    await ctx.ask({
      permission: "grep",
      patterns: [params.pattern],
      always: ["*"],
      metadata: {
        pattern: params.pattern,
        path: params.path,
        include: params.include,
      },
    });

    let searchPath = params.path ?? process.cwd();
    searchPath = path.isAbsolute(searchPath) ? searchPath : path.resolve(process.cwd(), searchPath);

    // Try ripgrep first
    const rgResult = await tryRipgrep(params.pattern, searchPath, params.include);
    if (rgResult !== null) {
      return rgResult;
    }

    // Fallback: built-in regex search
    return await builtinSearch(params.pattern, searchPath, params.include);
  },
});

interface Match {
  path: string;
  modTime: number;
  lineNum: number;
  lineText: string;
}

async function tryRipgrep(
  pattern: string,
  searchPath: string,
  include?: string,
): Promise<{
  title: string;
  metadata: Record<string, unknown>;
  output: string;
} | null> {
  try {
    const args = [
      "-nH",
      "--hidden",
      "--follow",
      "--no-messages",
      "--field-match-separator=|",
      "--regexp",
      pattern,
    ];
    if (include) {
      args.push("--glob", include);
    }
    args.push(searchPath);

    const { stdout } = await execFileAsync("rg", args, {
      maxBuffer: 10 * 1024 * 1024,
    }).catch((err) => {
      // Exit code 1 = no matches, which is fine
      if (err.code === 1) return { stdout: "", stderr: "" };
      // Exit code 2 with some output = partial results
      if (err.code === 2 && err.stdout) return { stdout: err.stdout, stderr: err.stderr };
      throw err;
    });

    if (!stdout.trim()) {
      return {
        title: pattern,
        metadata: { matches: 0, truncated: false },
        output: "No files found",
      };
    }

    const lines = stdout.trim().split(/\r?\n/);
    const matches: Match[] = [];

    for (const line of lines) {
      if (!line) continue;
      const [filePath, lineNumStr, ...lineTextParts] = line.split("|");
      if (!filePath || !lineNumStr || lineTextParts.length === 0) continue;

      const lineNum = parseInt(lineNumStr, 10);
      const lineText = lineTextParts.join("|");
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat) continue;

      matches.push({
        path: filePath,
        modTime: stat.mtime.getTime(),
        lineNum,
        lineText,
      });
    }

    return formatMatches(pattern, matches);
  } catch {
    // ripgrep not available
    return null;
  }
}

async function builtinSearch(
  pattern: string,
  searchPath: string,
  include?: string,
): Promise<{
  title: string;
  metadata: Record<string, unknown>;
  output: string;
}> {
  const regex = new RegExp(pattern, "g");
  const matches: Match[] = [];

  async function searchDir(dir: string): Promise<void> {
    if (matches.length >= RESULT_LIMIT) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (matches.length >= RESULT_LIMIT) break;
        if (entry.name.startsWith(".") && entry.name !== ".") continue;
        if (entry.name === "node_modules") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await searchDir(full);
        } else {
          if (include && !matchGlob(entry.name, include)) continue;
          try {
            const content = await fs.readFile(full, "utf-8");
            const lines = content.split("\n");
            const stat = await fs.stat(full).catch(() => null);
            for (let i = 0; i < lines.length; i++) {
              regex.lastIndex = 0;
              if (regex.test(lines[i])) {
                matches.push({
                  path: full,
                  modTime: stat?.mtime.getTime() ?? 0,
                  lineNum: i + 1,
                  lineText: lines[i],
                });
                if (matches.length >= RESULT_LIMIT) break;
              }
            }
          } catch {
            // Binary or unreadable file
          }
        }
      }
    } catch {
      // Permission denied
    }
  }

  await searchDir(searchPath);
  return formatMatches(pattern, matches);
}

function formatMatches(
  pattern: string,
  matches: Match[],
): {
  title: string;
  metadata: Record<string, unknown>;
  output: string;
} {
  matches.sort((a, b) => b.modTime - a.modTime);

  const truncated = matches.length > RESULT_LIMIT;
  const finalMatches = truncated ? matches.slice(0, RESULT_LIMIT) : matches;

  if (finalMatches.length === 0) {
    return {
      title: pattern,
      metadata: { matches: 0, truncated: false },
      output: "No files found",
    };
  }

  const outputLines = [`Found ${finalMatches.length} matches`];
  let currentFile = "";
  for (const match of finalMatches) {
    if (currentFile !== match.path) {
      if (currentFile !== "") outputLines.push("");
      currentFile = match.path;
      outputLines.push(`${match.path}:`);
    }
    const truncatedLineText =
      match.lineText.length > MAX_LINE_LENGTH
        ? match.lineText.substring(0, MAX_LINE_LENGTH) + "..."
        : match.lineText;
    outputLines.push(`  Line ${match.lineNum}: ${truncatedLineText}`);
  }

  if (truncated) {
    outputLines.push("");
    outputLines.push("(Results are truncated. Consider using a more specific path or pattern.)");
  }

  return {
    title: pattern,
    metadata: { matches: finalMatches.length, truncated },
    output: outputLines.join("\n"),
  };
}

function matchGlob(name: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const ext = pattern.slice(1);
    // Handle {ts,tsx} patterns
    if (ext.includes("{") && ext.includes("}")) {
      const exts = ext.slice(ext.indexOf("{") + 1, ext.indexOf("}")).split(",");
      return exts.some((e) => name.endsWith(`.${e.trim()}`));
    }
    return name.endsWith(ext);
  }
  return name === pattern;
}
