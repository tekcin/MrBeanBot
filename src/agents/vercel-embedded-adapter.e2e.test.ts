/**
 * End-to-end test for the Vercel AI SDK embedded adapter.
 * Tests both low-level language model creation and high-level agent execution
 * using a local Ollama instance.
 *
 * Requires: Ollama running locally at http://127.0.0.1:11434
 */
import { describe, it, expect, beforeAll } from "vitest";
import { streamText } from "ai";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";
const OLLAMA_API_BASE = "http://127.0.0.1:11434";
const TIMEOUT = 120_000;

/**
 * Check if Ollama is reachable and pick the best model for testing.
 * Prefers non-reasoning models to avoid reasoning-only responses.
 */
async function isOllamaAvailable(): Promise<{ available: boolean; model?: string }> {
  try {
    const res = await fetch(`${OLLAMA_API_BASE}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { available: false };
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = data.models?.map((m) => m.name) ?? [];
    if (models.length === 0) return { available: false };

    // Prefer non-reasoning models (they produce text output directly)
    const preferred = ["nemotron", "glm", "llama", "phi", "qwen", "mistral"];
    for (const prefix of preferred) {
      const match = models.find((m) => m.toLowerCase().includes(prefix));
      if (match) return { available: true, model: match };
    }
    // Fall back to first available
    return { available: true, model: models[0] };
  } catch {
    return { available: false };
  }
}

let ollamaModel = "";
let ollamaAvailable = false;

beforeAll(async () => {
  const result = await isOllamaAvailable();
  ollamaAvailable = result.available;
  ollamaModel = result.model ?? "gpt-oss:20b";
  if (ollamaAvailable) {
    console.log(`[e2e] Using Ollama model: ${ollamaModel}`);
  }
});

describe("Vercel AI SDK adapter E2E", () => {
  describe("Low-level: createLanguageModel + streamText", () => {
    it(
      "streams a response from Ollama via @ai-sdk/openai-compatible",
      async () => {
        if (!ollamaAvailable) return;

        const mod = await import("@ai-sdk/openai-compatible");
        const ollamaProvider = mod.createOpenAICompatible({
          name: "ollama",
          baseURL: OLLAMA_BASE_URL,
          apiKey: "ollama-local",
        });

        const language: LanguageModelV2 = ollamaProvider.languageModel(
          ollamaModel,
        ) as unknown as LanguageModelV2;

        const result = streamText({
          model: language,
          messages: [{ role: "user", content: "Say exactly: hello world" }],
          maxOutputTokens: 512,
          maxRetries: 0,
        });

        let text = "";
        let reasoningText = "";
        let eventCount = 0;
        const eventTypes = new Set<string>();
        for await (const event of result.fullStream) {
          const ev = event as { type: string; [key: string]: unknown };
          eventTypes.add(ev.type);

          if (ev.type === "text-delta") {
            // ai v5: text-delta events use "text" property (not "textDelta")
            text += (ev["text"] as string) ?? "";
            eventCount++;
          } else if (ev.type === "reasoning-delta") {
            // ai v5: reasoning-delta events also use "text" property
            reasoningText += (ev["text"] as string) ?? "";
            eventCount++;
          }
        }

        console.log(`[low-level] Event types: ${[...eventTypes].join(", ")}`);
        console.log(
          `[low-level] Events: ${eventCount}, text=${text.length}ch, reasoning=${reasoningText.length}ch`,
        );
        console.log(`[low-level] Text: "${text.slice(0, 200)}"`);
        if (reasoningText) {
          console.log(`[low-level] Reasoning: "${reasoningText.slice(0, 200)}"`);
        }

        // Model may produce text, reasoning, or both
        const totalContent = text.length + reasoningText.length;
        expect(eventCount).toBeGreaterThan(0);
        expect(totalContent).toBeGreaterThan(0);
      },
      TIMEOUT,
    );
  });

  describe("High-level: runVercelEmbeddedAgent", () => {
    it(
      "runs a full agent invocation via the Vercel adapter with Ollama",
      async () => {
        if (!ollamaAvailable) return;

        const prevKey = process.env.OLLAMA_API_KEY;
        process.env.OLLAMA_API_KEY = "ollama-local";

        try {
          const workspace = mkdtempSync(join(tmpdir(), "mrbeanbot-vercel-e2e-"));
          const sessionFile = join(workspace, "session.jsonl");
          writeFileSync(sessionFile, "");

          const agentDir = join(workspace, "agents", "main");
          mkdirSync(agentDir, { recursive: true });
          writeFileSync(
            join(workspace, "agents", "auth-profiles.json"),
            JSON.stringify({ profiles: {}, version: 1 }),
          );

          const config = {
            agents: {
              defaults: {
                useVercelSdk: true,
                workspace,
              },
            },
            models: {
              providers: {
                ollama: {
                  baseUrl: OLLAMA_BASE_URL,
                  apiKey: "ollama-local",
                  api: "openai-completions" as const,
                  models: [
                    {
                      id: ollamaModel,
                      name: ollamaModel,
                      reasoning: false,
                      input: ["text"] as Array<"text" | "image">,
                      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                      contextWindow: 128000,
                      maxTokens: 8192,
                    },
                  ],
                },
              },
            },
          };

          const { runVercelEmbeddedAgent } = await import("./vercel-embedded-adapter.js");

          const partials: string[] = [];
          const reasoningChunks: string[] = [];
          const lifecycleEvents: string[] = [];

          const result = await runVercelEmbeddedAgent({
            sessionId: "e2e-test-session",
            sessionKey: "e2e:test:vercel-adapter",
            workspaceDir: workspace,
            sessionFile,
            agentDir,
            config: config as any,
            prompt: 'Reply with exactly the word "pong" and nothing else.',
            provider: "ollama",
            model: ollamaModel,
            timeoutMs: TIMEOUT,
            runId: "e2e-run-1",
            thinkLevel: "off",
            streamParams: { maxTokens: 512 },
            onPartialReply: async ({ text }: { text: string }) => {
              partials.push(text);
            },
            onReasoningStream: async ({ text }: { text: string }) => {
              reasoningChunks.push(text);
            },
            onAgentEvent: (event: { stream?: string; data?: Record<string, unknown> }) => {
              if (event.data?.phase) {
                lifecycleEvents.push(event.data.phase as string);
              }
            },
          } as any);

          const replyText = result.payloads?.[0]?.text ?? "";
          const hasReasoning = reasoningChunks.length > 0;
          const reasoningTotal = reasoningChunks.join("");

          console.log(`[high-level] Payloads: ${result.payloads?.length ?? 0}`);
          console.log(`[high-level] Reply text: "${replyText.slice(0, 200)}"`);
          console.log(`[high-level] Partial count: ${partials.length}`);
          console.log(
            `[high-level] Reasoning chunks: ${reasoningChunks.length} (${reasoningTotal.length} chars)`,
          );
          console.log(`[high-level] Lifecycle: ${lifecycleEvents.join(" → ")}`);
          console.log(`[high-level] Duration: ${result.meta?.durationMs}ms`);
          if (result.meta?.error) {
            console.log(`[high-level] Error: ${JSON.stringify(result.meta.error)}`);
          }

          // The adapter completed without throwing
          expect(result.meta).toBeTruthy();
          expect(result.meta.durationMs).toBeGreaterThan(0);

          // Should have produced content (text or reasoning or both)
          const hasContent = replyText.length > 0 || hasReasoning;
          expect(hasContent).toBe(true);

          // If the model produced text output, it should be in payloads
          if (replyText.length > 0) {
            expect(result.payloads).toBeTruthy();
            expect(partials.length).toBeGreaterThan(0);
          }

          // Lifecycle events should include start and end
          expect(lifecycleEvents).toContain("start");
          expect(lifecycleEvents.some((e) => e === "end" || e === "error")).toBe(true);
        } finally {
          if (prevKey !== undefined) {
            process.env.OLLAMA_API_KEY = prevKey;
          } else {
            delete process.env.OLLAMA_API_KEY;
          }
        }
      },
      TIMEOUT,
    );
  });
});
