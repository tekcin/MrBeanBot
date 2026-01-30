/**
 * WebFetch tool ported from OpenCode.
 * Fetches web content and converts HTML to markdown.
 */
import z from "zod";
import { Tool } from "../tool.js";

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_TIMEOUT = 30 * 1000; // 30 seconds
const MAX_TIMEOUT = 120 * 1000; // 2 minutes

const DESCRIPTION = `Fetches content from a URL and returns it as text or markdown.
- URL must start with http:// or https://
- Returns markdown by default (converts HTML automatically)
- Max response size: 5MB
- Timeout: 30 seconds (configurable up to 2 minutes)`;

export const WebFetchTool = Tool.define("webfetch", {
  description: DESCRIPTION,
  parameters: z.object({
    url: z.string().describe("The URL to fetch content from"),
    format: z
      .enum(["text", "markdown", "html"])
      .default("markdown")
      .describe("The format to return the content in. Defaults to markdown."),
    timeout: z.number().describe("Optional timeout in seconds (max 120)").optional(),
  }),
  async execute(params, ctx) {
    if (!params.url.startsWith("http://") && !params.url.startsWith("https://")) {
      throw new Error("URL must start with http:// or https://");
    }

    await ctx.ask({
      permission: "webfetch",
      patterns: [params.url],
      always: ["*"],
      metadata: {
        url: params.url,
        format: params.format,
        timeout: params.timeout,
      },
    });

    const timeout = Math.min((params.timeout ?? DEFAULT_TIMEOUT / 1000) * 1000, MAX_TIMEOUT);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const signal = AbortSignal.any([controller.signal, ctx.abort]);

    let acceptHeader = "*/*";
    switch (params.format) {
      case "markdown":
        acceptHeader =
          "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1";
        break;
      case "text":
        acceptHeader = "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1";
        break;
      case "html":
        acceptHeader = "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, */*;q=0.1";
        break;
    }

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
      Accept: acceptHeader,
      "Accept-Language": "en-US,en;q=0.9",
    };

    const response = await fetch(params.url, { signal, headers });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Request failed with status code: ${response.status}`);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      throw new Error("Response too large (exceeds 5MB limit)");
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
      throw new Error("Response too large (exceeds 5MB limit)");
    }

    const content = new TextDecoder().decode(arrayBuffer);
    const contentType = response.headers.get("content-type") || "";
    const title = `${params.url} (${contentType})`;

    // Convert HTML to markdown if needed
    if (params.format === "markdown" && contentType.includes("text/html")) {
      const markdown = await convertHTMLToMarkdown(content);
      return { output: markdown, title, metadata: {} };
    }

    if (params.format === "text" && contentType.includes("text/html")) {
      const text = stripHTMLTags(content);
      return { output: text, title, metadata: {} };
    }

    return { output: content, title, metadata: {} };
  },
});

async function convertHTMLToMarkdown(html: string): Promise<string> {
  try {
    // Try to use turndown if available
    const { default: TurndownService } = await import("turndown");
    const turndownService = new TurndownService({
      headingStyle: "atx",
      hr: "---",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "*",
    });
    turndownService.remove(["script", "style", "meta", "link"]);
    return turndownService.turndown(html);
  } catch {
    // Fallback: strip tags
    return stripHTMLTags(html);
  }
}

function stripHTMLTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}
