import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withTempHome } from "../../test/helpers/temp-home.js";
import type { MrBeanBotConfig } from "../config/config.js";

// We test ollamaSetupCommand by dynamically importing after resetting modules,
// so that config IO picks up the temp HOME directory.

function createMockRuntime() {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    runtime: {
      log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
      error: (...args: unknown[]) => errors.push(args.map(String).join(" ")),
      exit: (code: number) => {
        throw new Error(`process.exit(${code})`);
      },
    } as { log: typeof console.log; error: typeof console.error; exit: (code: number) => never },
    logs,
    errors,
  };
}

function mockOllamaResponse(models: Array<{ name: string }>) {
  return new Response(JSON.stringify({ models }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ollama setup command", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("discovers models and writes config", async () => {
    await withTempHome(async (home) => {
      vi.resetModules();

      // Write an initial empty config
      const configDir = path.join(home, ".mrbeanbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(path.join(configDir, "mrbeanbot.json"), JSON.stringify({}));

      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(mockOllamaResponse([{ name: "llama3.3" }, { name: "deepseek-r1:32b" }]));

      const { ollamaSetupCommand } = await import("./ollama-setup.js");
      const mock = createMockRuntime();

      await ollamaSetupCommand({}, mock.runtime);

      expect(mock.logs.some((l) => l.includes("Discovered 2 model(s)"))).toBe(true);
      expect(mock.logs.some((l) => l.includes("llama3.3"))).toBe(true);
      expect(mock.logs.some((l) => l.includes("deepseek-r1:32b"))).toBe(true);

      // Verify config was written
      const raw = await fs.readFile(path.join(configDir, "mrbeanbot.json"), "utf-8");
      const cfg = JSON.parse(raw) as MrBeanBotConfig;
      expect(cfg.models?.providers?.ollama).toBeDefined();
      expect(cfg.models?.providers?.ollama?.apiKey).toBe("ollama-local");
      expect(cfg.models?.providers?.ollama?.models).toHaveLength(2);
      expect(cfg.models?.providers?.ollama?.models?.[0]?.id).toBe("llama3.3");
      expect(cfg.models?.providers?.ollama?.models?.[1]?.id).toBe("deepseek-r1:32b");
      expect(cfg.models?.providers?.ollama?.models?.[1]?.reasoning).toBe(true);
    });
  });

  it("throws a clear error when Ollama is unreachable", async () => {
    await withTempHome(async (home) => {
      vi.resetModules();

      const configDir = path.join(home, ".mrbeanbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(path.join(configDir, "mrbeanbot.json"), JSON.stringify({}));

      globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

      const { ollamaSetupCommand } = await import("./ollama-setup.js");
      const mock = createMockRuntime();

      await expect(ollamaSetupCommand({}, mock.runtime)).rejects.toThrow(/Could not reach Ollama/);
    });
  });

  it("warns on empty model list", async () => {
    await withTempHome(async (home) => {
      vi.resetModules();

      const configDir = path.join(home, ".mrbeanbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(path.join(configDir, "mrbeanbot.json"), JSON.stringify({}));

      globalThis.fetch = vi.fn().mockResolvedValue(mockOllamaResponse([]));

      const { ollamaSetupCommand } = await import("./ollama-setup.js");
      const mock = createMockRuntime();

      await ollamaSetupCommand({}, mock.runtime);

      expect(mock.logs.some((l) => l.includes("Warning"))).toBe(true);
      expect(mock.logs.some((l) => l.includes("no models were found"))).toBe(true);
    });
  });

  it("preserves existing config during merge", async () => {
    await withTempHome(async (home) => {
      vi.resetModules();

      const configDir = path.join(home, ".mrbeanbot");
      await fs.mkdir(configDir, { recursive: true });

      const existingConfig: MrBeanBotConfig = {
        models: {
          providers: {
            openai: {
              baseUrl: "https://api.openai.com/v1",
              apiKey: "sk-test",
              models: [
                {
                  id: "gpt-4",
                  name: "GPT-4",
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 30, output: 60, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 128000,
                  maxTokens: 8192,
                },
              ],
            },
          },
        },
      };
      await fs.writeFile(path.join(configDir, "mrbeanbot.json"), JSON.stringify(existingConfig));

      globalThis.fetch = vi.fn().mockResolvedValue(mockOllamaResponse([{ name: "llama3.3" }]));

      const { ollamaSetupCommand } = await import("./ollama-setup.js");
      const mock = createMockRuntime();

      await ollamaSetupCommand({}, mock.runtime);

      const raw = await fs.readFile(path.join(configDir, "mrbeanbot.json"), "utf-8");
      const cfg = JSON.parse(raw) as MrBeanBotConfig;

      // Existing OpenAI provider should still be present
      expect(cfg.models?.providers?.openai).toBeDefined();
      expect(cfg.models?.providers?.openai?.apiKey).toBe("sk-test");

      // Ollama provider should be added
      expect(cfg.models?.providers?.ollama).toBeDefined();
      expect(cfg.models?.providers?.ollama?.models).toHaveLength(1);
    });
  });

  it("sets default model with --set-default", async () => {
    await withTempHome(async (home) => {
      vi.resetModules();

      const configDir = path.join(home, ".mrbeanbot");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(path.join(configDir, "mrbeanbot.json"), JSON.stringify({}));

      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(
          mockOllamaResponse([{ name: "llama3.3" }, { name: "qwen2.5-coder:32b" }]),
        );

      const { ollamaSetupCommand } = await import("./ollama-setup.js");
      const mock = createMockRuntime();

      await ollamaSetupCommand({ setDefault: true }, mock.runtime);

      const raw = await fs.readFile(path.join(configDir, "mrbeanbot.json"), "utf-8");
      const cfg = JSON.parse(raw) as MrBeanBotConfig;
      expect(cfg.agents?.defaults?.model?.primary).toBe("ollama/llama3.3");
      expect(mock.logs.some((l) => l.includes("Default model set to: ollama/llama3.3"))).toBe(true);
    });
  });
});
