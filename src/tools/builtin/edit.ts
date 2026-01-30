/**
 * Edit tool ported from OpenCode.
 * Performs exact string replacements in files with multiple fallback strategies.
 */
import z from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { Tool } from "../tool.js";

const DESCRIPTION = `Performs exact string replacements in files.
- The filePath must be an absolute path
- oldString must exist in the file and be unique (unless replaceAll is true)
- newString must be different from oldString
- Preserve exact indentation as it appears in the file
- Use replaceAll to replace every occurrence`;

export const EditTool = Tool.define("edit", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The absolute path to the file to modify"),
    oldString: z.string().describe("The text to replace"),
    newString: z
      .string()
      .describe("The text to replace it with (must be different from oldString)"),
    replaceAll: z
      .boolean()
      .optional()
      .describe("Replace all occurrences of oldString (default false)"),
  }),
  async execute(params, ctx) {
    if (!params.filePath) {
      throw new Error("filePath is required");
    }
    if (params.oldString === params.newString) {
      throw new Error("oldString and newString must be different");
    }

    const filePath = path.isAbsolute(params.filePath)
      ? params.filePath
      : path.join(process.cwd(), params.filePath);

    await ctx.ask({
      permission: "edit",
      patterns: [filePath],
      always: ["*"],
      metadata: { filepath: filePath },
    });

    // Handle empty oldString (full file replacement)
    if (params.oldString === "") {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, params.newString, "utf-8");
      return {
        title: path.basename(filePath),
        metadata: { diagnostics: {}, truncated: false },
        output: "Edit applied successfully.",
      };
    }

    // Read existing file
    let contentOld: string;
    try {
      contentOld = await fs.readFile(filePath, "utf-8");
    } catch {
      throw new Error(`File ${filePath} not found`);
    }

    const contentNew = replace(contentOld, params.oldString, params.newString, params.replaceAll);

    await fs.writeFile(filePath, contentNew, "utf-8");

    return {
      title: path.basename(filePath),
      metadata: { diagnostics: {}, truncated: false },
      output: "Edit applied successfully.",
    };
  },
});

/**
 * Replace oldString in content using multiple strategies.
 * Tries exact match first, then falls back to fuzzy matching.
 */
function replace(
  content: string,
  oldString: string,
  newString: string,
  replaceAll = false,
): string {
  for (const replacer of [
    simpleReplacer,
    lineTrimmedReplacer,
    whitespaceNormalizedReplacer,
    indentationFlexibleReplacer,
  ]) {
    for (const search of replacer(content, oldString)) {
      const index = content.indexOf(search);
      if (index === -1) continue;
      if (replaceAll) {
        return content.replaceAll(search, newString);
      }
      const lastIndex = content.lastIndexOf(search);
      if (index !== lastIndex) continue; // Multiple matches - ambiguous
      return content.substring(0, index) + newString + content.substring(index + search.length);
    }
  }
  throw new Error(
    `Could not find the specified oldString in the file. Make sure you have the exact text including whitespace and indentation.`,
  );
}

/** Direct string match. */
function* simpleReplacer(_content: string, oldString: string): Generator<string> {
  yield oldString;
}

/** Match after trimming each line. */
function* lineTrimmedReplacer(content: string, oldString: string): Generator<string> {
  const contentLines = content.split("\n");
  const searchLines = oldString.split("\n");
  if (searchLines.length === 0) return;

  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    let matched = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (contentLines[i + j].trim() !== searchLines[j].trim()) {
        matched = false;
        break;
      }
    }
    if (matched) {
      yield contentLines.slice(i, i + searchLines.length).join("\n");
    }
  }
}

/** Match after normalizing runs of whitespace. */
function* whitespaceNormalizedReplacer(content: string, oldString: string): Generator<string> {
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const contentLines = content.split("\n");
  const searchLines = oldString.split("\n");
  if (searchLines.length === 0) return;

  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    let matched = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (normalize(contentLines[i + j]) !== normalize(searchLines[j])) {
        matched = false;
        break;
      }
    }
    if (matched) {
      yield contentLines.slice(i, i + searchLines.length).join("\n");
    }
  }
}

/** Match ignoring leading indentation differences. */
function* indentationFlexibleReplacer(content: string, oldString: string): Generator<string> {
  const contentLines = content.split("\n");
  const searchLines = oldString.split("\n");
  if (searchLines.length === 0) return;

  const stripIndent = (line: string) => line.replace(/^[\t ]+/, "");

  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    let matched = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (stripIndent(contentLines[i + j]) !== stripIndent(searchLines[j])) {
        matched = false;
        break;
      }
    }
    if (matched) {
      yield contentLines.slice(i, i + searchLines.length).join("\n");
    }
  }
}
