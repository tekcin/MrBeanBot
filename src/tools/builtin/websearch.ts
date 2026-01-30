/**
 * WebSearch tool ported from OpenCode.
 * Searches the web using a configurable search API.
 */
import z from "zod";
import { Tool } from "../tool.js";

const DESCRIPTION = `Searches the web for information.
- Returns search results with titles, URLs, and snippets
- Use this for current events, documentation, or any web-accessible information`;

export const WebSearchTool = Tool.define("websearch", {
  description: DESCRIPTION,
  parameters: z.object({
    query: z.string().describe("The search query"),
    limit: z.number().describe("Maximum number of results to return (default 5)").optional(),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "websearch",
      patterns: [params.query],
      always: ["*"],
      metadata: { query: params.query },
    });

    const limit = params.limit ?? 5;

    // Try multiple search backends in order of preference
    const result = await searchWeb(params.query, limit);

    return {
      title: params.query,
      metadata: { count: result.results.length },
      output: result.output,
    };
  },
});

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function searchWeb(
  query: string,
  limit: number,
): Promise<{ results: SearchResult[]; output: string }> {
  // Try Exa API if available
  const exaKey = process.env.EXA_API_KEY;
  if (exaKey) {
    try {
      return await searchExa(query, limit, exaKey);
    } catch {
      // Fall through to other backends
    }
  }

  // Try SerpAPI if available
  const serpApiKey = process.env.SERPAPI_KEY;
  if (serpApiKey) {
    try {
      return await searchSerpApi(query, limit, serpApiKey);
    } catch {
      // Fall through
    }
  }

  return {
    results: [],
    output: `No search API configured. Set EXA_API_KEY or SERPAPI_KEY environment variable to enable web search.`,
  };
}

async function searchExa(
  query: string,
  limit: number,
  apiKey: string,
): Promise<{ results: SearchResult[]; output: string }> {
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      numResults: limit,
      type: "keyword",
      contents: {
        text: { maxCharacters: 500 },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Exa API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    results: Array<{
      title: string;
      url: string;
      text?: string;
    }>;
  };

  const results: SearchResult[] = data.results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.text ?? "",
  }));

  const output = formatResults(results);
  return { results, output };
}

async function searchSerpApi(
  query: string,
  limit: number,
  apiKey: string,
): Promise<{ results: SearchResult[]; output: string }> {
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", String(limit));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`SerpAPI error: ${response.status}`);
  }

  const data = (await response.json()) as {
    organic_results?: Array<{
      title: string;
      link: string;
      snippet?: string;
    }>;
  };

  const results: SearchResult[] = (data.organic_results ?? []).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet ?? "",
  }));

  const output = formatResults(results);
  return { results, output };
}

function formatResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No results found";
  }

  const lines: string[] = [`Found ${results.length} results:\n`];
  for (const result of results) {
    lines.push(`## ${result.title}`);
    lines.push(`URL: ${result.url}`);
    if (result.snippet) {
      lines.push(result.snippet);
    }
    lines.push("");
  }
  return lines.join("\n");
}
