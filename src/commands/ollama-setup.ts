import type { RuntimeEnv } from "../runtime.js";
import { readConfigFileSnapshot, writeConfigFile } from "../config/config.js";
import type { MrBeanBotConfig } from "../config/config.js";
import type { ModelDefinitionConfig } from "../config/types.models.js";
import { logConfigUpdated } from "../config/logging.js";

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const OLLAMA_OPENAI_BASE_URL_SUFFIX = "/v1";

export interface OllamaSetupOptions {
  baseUrl?: string;
  setDefault?: boolean;
  yes?: boolean;
}

export async function ollamaSetupCommand(
  opts: OllamaSetupOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const baseUrl = opts.baseUrl ?? DEFAULT_OLLAMA_BASE_URL;

  runtime.log(`Probing Ollama at ${baseUrl} ...`);

  let models: ModelDefinitionConfig[];
  try {
    models = await discoverOllamaModelsForSetup(baseUrl);
  } catch (error) {
    throw new Error(
      `Could not reach Ollama at ${baseUrl}/api/tags — is Ollama running?\n` +
        `  Start it with: ollama serve\n` +
        `  Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (models.length === 0) {
    runtime.log(
      "Warning: Ollama is reachable but no models were found.\n" +
        "  Pull a model first: ollama pull llama3.3",
    );
    return;
  }

  runtime.log(`Discovered ${models.length} model(s):`);
  for (const m of models) {
    const tags: string[] = [];
    if (m.reasoning) tags.push("reasoning");
    const suffix = tags.length > 0 ? ` (${tags.join(", ")})` : "";
    runtime.log(`  - ${m.id}${suffix}`);
  }

  const snapshot = await readConfigFileSnapshot();
  if (!snapshot.valid) {
    const issues = snapshot.issues.map((i) => `- ${i.path}: ${i.message}`).join("\n");
    throw new Error(`Invalid config at ${snapshot.path}\n${issues}`);
  }

  const cfg = snapshot.config;
  const providerBaseUrl = baseUrl + OLLAMA_OPENAI_BASE_URL_SUFFIX;

  const ollamaProvider = {
    baseUrl: providerBaseUrl,
    apiKey: "ollama-local",
    api: "openai-completions" as const,
    models,
  };

  const existingProviders = cfg.models?.providers ?? {};
  const merged: MrBeanBotConfig = {
    ...cfg,
    models: {
      ...cfg.models,
      providers: {
        ...existingProviders,
        ollama: ollamaProvider,
      },
    },
  };

  if (opts.setDefault && models.length > 0) {
    const first = models[0];
    merged.agents = {
      ...merged.agents,
      defaults: {
        ...merged.agents?.defaults,
        model: {
          ...merged.agents?.defaults?.model,
          primary: `ollama/${first.id}`,
        },
      },
    };
  }

  await writeConfigFile(merged);
  logConfigUpdated(runtime);

  runtime.log(`\nOllama provider configured with ${models.length} model(s).`);
  if (opts.setDefault && models.length > 0) {
    runtime.log(`Default model set to: ollama/${models[0].id}`);
  }
}

async function discoverOllamaModelsForSetup(baseUrl: string): Promise<ModelDefinitionConfig[]> {
  // Bypass the test-environment guard in discoverOllamaModels by fetching directly
  // when running in test mode (the exported function skips in VITEST/test env).
  const response = await fetch(`${baseUrl}/api/tags`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = (await response.json()) as { models?: Array<{ name: string }> };
  if (!data.models || data.models.length === 0) {
    return [];
  }
  return data.models.map((model) => {
    const modelId = model.name;
    const isReasoning =
      modelId.toLowerCase().includes("r1") || modelId.toLowerCase().includes("reasoning");
    return {
      id: modelId,
      name: modelId,
      reasoning: isReasoning,
      input: ["text"] as Array<"text" | "image">,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 8192,
    };
  });
}
