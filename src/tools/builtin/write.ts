/**
 * Write tool ported from OpenCode.
 * Writes content to a file, creating directories as needed.
 */
import z from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { Tool } from "../tool.js";

const DESCRIPTION = `Writes content to a file on the local filesystem.
- The filePath must be an absolute path
- Creates parent directories if they don't exist
- Overwrites the file if it already exists
- Prefer editing existing files over writing new ones`;

export const WriteTool = Tool.define("write", {
  description: DESCRIPTION,
  parameters: z.object({
    content: z.string().describe("The content to write to the file"),
    filePath: z
      .string()
      .describe("The absolute path to the file to write (must be absolute, not relative)"),
  }),
  async execute(params, ctx) {
    const filepath = path.isAbsolute(params.filePath)
      ? params.filePath
      : path.join(process.cwd(), params.filePath);

    await ctx.ask({
      permission: "edit",
      patterns: [filepath],
      always: ["*"],
      metadata: { filepath },
    });

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });

    // Check if file exists
    let exists = false;
    try {
      await fs.access(filepath);
      exists = true;
    } catch {
      // File doesn't exist
    }

    await fs.writeFile(filepath, params.content, "utf-8");

    return {
      title: path.basename(filepath),
      metadata: {
        filepath,
        exists,
      },
      output: "Wrote file successfully.",
    };
  },
});
