/**
 * Read tool ported from OpenCode.
 * Reads file contents with line numbers, offset/limit, and binary detection.
 */
import z from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { Tool } from "../tool.js";

const DEFAULT_READ_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const MAX_BYTES = 50 * 1024;

const DESCRIPTION = `Reads a file from the local filesystem. Returns file contents with line numbers.
- The filePath parameter must be an absolute path
- By default, reads up to 2000 lines from the beginning of the file
- Use offset and limit for pagination on large files
- Lines longer than 2000 characters are truncated
- Results are returned with line numbers starting at 1
- Cannot read binary files`;

export const ReadTool = Tool.define("read", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The path to the file to read"),
    offset: z.coerce
      .number()
      .describe("The line number to start reading from (0-based)")
      .optional(),
    limit: z.coerce.number().describe("The number of lines to read (defaults to 2000)").optional(),
  }),
  async execute(params, ctx) {
    let filepath = params.filePath;
    if (!path.isAbsolute(filepath)) {
      filepath = path.join(process.cwd(), filepath);
    }
    const title = path.basename(filepath);

    await ctx.ask({
      permission: "read",
      patterns: [filepath],
      always: ["*"],
      metadata: {},
    });

    // Check file exists
    try {
      await fs.access(filepath);
    } catch {
      const dir = path.dirname(filepath);
      const base = path.basename(filepath);
      try {
        const dirEntries = await fs.readdir(dir);
        const suggestions = dirEntries
          .filter(
            (entry) =>
              entry.toLowerCase().includes(base.toLowerCase()) ||
              base.toLowerCase().includes(entry.toLowerCase()),
          )
          .map((entry) => path.join(dir, entry))
          .slice(0, 3);
        if (suggestions.length > 0) {
          throw new Error(
            `File not found: ${filepath}\n\nDid you mean one of these?\n${suggestions.join("\n")}`,
          );
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("File not found:")) throw e;
      }
      throw new Error(`File not found: ${filepath}`);
    }

    // Check for binary
    if (await isBinaryFile(filepath)) {
      throw new Error(`Cannot read binary file: ${filepath}`);
    }

    // Read file
    const content = await fs.readFile(filepath, "utf-8");
    const lines = content.split("\n");

    const limit = params.limit ?? DEFAULT_READ_LIMIT;
    const offset = params.offset || 0;

    const raw: string[] = [];
    let bytes = 0;
    let truncatedByBytes = false;
    for (let i = offset; i < Math.min(lines.length, offset + limit); i++) {
      const line =
        lines[i].length > MAX_LINE_LENGTH
          ? lines[i].substring(0, MAX_LINE_LENGTH) + "..."
          : lines[i];
      const size = Buffer.byteLength(line, "utf-8") + (raw.length > 0 ? 1 : 0);
      if (bytes + size > MAX_BYTES) {
        truncatedByBytes = true;
        break;
      }
      raw.push(line);
      bytes += size;
    }

    const numbered = raw.map((line, index) => {
      return `${(index + offset + 1).toString().padStart(5, "0")}| ${line}`;
    });
    const preview = raw.slice(0, 20).join("\n");

    let output = "<file>\n";
    output += numbered.join("\n");

    const totalLines = lines.length;
    const lastReadLine = offset + raw.length;
    const hasMoreLines = totalLines > lastReadLine;
    const truncated = hasMoreLines || truncatedByBytes;

    if (truncatedByBytes) {
      output += `\n\n(Output truncated at ${MAX_BYTES} bytes. Use 'offset' parameter to read beyond line ${lastReadLine})`;
    } else if (hasMoreLines) {
      output += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${lastReadLine})`;
    } else {
      output += `\n\n(End of file - total ${totalLines} lines)`;
    }
    output += "\n</file>";

    return {
      title,
      output,
      metadata: {
        preview,
        truncated,
      },
    };
  },
});

const BINARY_EXTENSIONS = new Set([
  ".zip",
  ".tar",
  ".gz",
  ".exe",
  ".dll",
  ".so",
  ".class",
  ".jar",
  ".war",
  ".7z",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  ".ods",
  ".odp",
  ".bin",
  ".dat",
  ".obj",
  ".o",
  ".a",
  ".lib",
  ".wasm",
  ".pyc",
  ".pyo",
]);

async function isBinaryFile(filepath: string): Promise<boolean> {
  const ext = path.extname(filepath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;

  const stat = await fs.stat(filepath);
  if (stat.size === 0) return false;

  const bufferSize = Math.min(4096, stat.size);
  const fh = await fs.open(filepath, "r");
  try {
    const buffer = Buffer.alloc(bufferSize);
    await fh.read(buffer, 0, bufferSize, 0);

    let nonPrintableCount = 0;
    for (let i = 0; i < bufferSize; i++) {
      if (buffer[i] === 0) return true;
      if (buffer[i] < 9 || (buffer[i] > 13 && buffer[i] < 32)) {
        nonPrintableCount++;
      }
    }
    return nonPrintableCount / bufferSize > 0.3;
  } finally {
    await fh.close();
  }
}
