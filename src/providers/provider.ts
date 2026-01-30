/**
 * Unified provider system ported from OpenCode.
 * Manages 40+ AI providers via Vercel AI SDK.
 *
 * Bridges MrBeanBot's existing auth-profiles and model config
 * with OpenCode's dynamic provider loading pattern.
 */
import z from "zod";
import fuzzysort from "fuzzysort";
import type { LanguageModelV2 } from "@ai-sdk/provider";

export namespace Provider {
  export const Model = z
    .object({
      id: z.string(),
      providerID: z.string(),
      name: z.string(),
      family: z.string().optional(),
      api: z.object({
        id: z.string(),
        url: z.string().optional(),
        npm: z.string(),
      }),
      status: z.enum(["active", "preview", "alpha", "deprecated"]).optional(),
      headers: z.record(z.string(), z.string()).optional(),
      options: z.record(z.string(), z.any()).optional(),
      cost: z
        .object({
          input: z.number(),
          output: z.number(),
          cache: z
            .object({
              read: z.number(),
              write: z.number(),
            })
            .optional(),
          experimentalOver200K: z
            .object({
              input: z.number(),
              output: z.number(),
              cache: z
                .object({
                  read: z.number(),
                  write: z.number(),
                })
                .optional(),
            })
            .optional(),
        })
        .optional(),
      limit: z.object({
        context: z.number(),
        input: z.number().optional(),
        output: z.number(),
      }),
      capabilities: z
        .object({
          temperature: z.boolean().optional(),
          reasoning: z.boolean().optional(),
          attachment: z.boolean().optional(),
          toolcall: z.boolean().optional(),
          input: z
            .object({
              text: z.boolean(),
              audio: z.boolean(),
              image: z.boolean(),
              video: z.boolean(),
              pdf: z.boolean(),
            })
            .optional(),
          output: z
            .object({
              text: z.boolean(),
              audio: z.boolean(),
              image: z.boolean(),
              video: z.boolean(),
              pdf: z.boolean(),
            })
            .optional(),
          interleaved: z.boolean().optional(),
        })
        .optional(),
      release_date: z.string().optional(),
      variants: z.record(z.string(), z.any()).optional(),
    })
    .meta({
      ref: "ProviderModel",
    });
  export type Model = z.infer<typeof Model>;

  export const Info = z
    .object({
      id: z.string(),
      name: z.string(),
      source: z.enum(["env", "config", "custom", "api"]),
      env: z.string().array(),
      key: z.string().optional(),
      options: z.record(z.string(), z.any()),
      models: z.record(z.string(), Model),
    })
    .meta({
      ref: "Provider",
    });
  export type Info = z.infer<typeof Info>;

  /**
   * Map of bundled provider SDK factories.
   * Maps npm package name → create function.
   */
  const BUNDLED_PROVIDERS: Record<string, (options: any) => any> = {};

  let providers: Record<string, Info> = {};
  let languages = new Map<string, LanguageModelV2>();
  let initialized = false;

  /**
   * Register a bundled AI SDK provider factory.
   * Call during app startup for each installed @ai-sdk/* package.
   */
  export function registerBundledProvider(npmPackage: string, factory: (options: any) => any) {
    BUNDLED_PROVIDERS[npmPackage] = factory;
  }

  /**
   * Initialize the provider system with auto-detected providers.
   * Scans env vars, config, and plugin-registered providers.
   */
  export async function init(config: {
    providerConfig?: Record<string, any>;
    envVars?: Record<string, string | undefined>;
    disabledProviders?: string[];
  }) {
    providers = {};
    languages = new Map();

    const env = config.envVars ?? process.env;

    // Auto-detect providers from environment variables
    const envProviderMap: Record<string, string[]> = {
      anthropic: ["ANTHROPIC_API_KEY"],
      openai: ["OPENAI_API_KEY"],
      google: ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
      "amazon-bedrock": ["AWS_ACCESS_KEY_ID"],
      azure: ["AZURE_API_KEY"],
      xai: ["XAI_API_KEY"],
      mistral: ["MISTRAL_API_KEY"],
      groq: ["GROQ_API_KEY"],
      deepinfra: ["DEEPINFRA_API_KEY"],
      cerebras: ["CEREBRAS_API_KEY"],
      cohere: ["COHERE_API_KEY"],
      togetherai: ["TOGETHER_AI_API_KEY"],
      perplexity: ["PERPLEXITY_API_KEY"],
      openrouter: ["OPENROUTER_API_KEY"],
    };

    const disabled = new Set(config.disabledProviders ?? []);

    for (const [providerID, envKeys] of Object.entries(envProviderMap)) {
      if (disabled.has(providerID)) continue;
      const key = envKeys.find((k) => env[k]);
      if (!key) continue;

      providers[providerID] = {
        id: providerID,
        name: providerID,
        source: "env",
        env: envKeys,
        key: env[key],
        options: {},
        models: {},
      };
    }

    // Merge config-defined providers
    for (const [providerID, providerCfg] of Object.entries(config.providerConfig ?? {})) {
      if (disabled.has(providerID)) continue;
      const existing = providers[providerID];
      providers[providerID] = {
        id: providerID,
        name: providerCfg.name ?? existing?.name ?? providerID,
        source: "config",
        env: providerCfg.env ?? existing?.env ?? [],
        key: providerCfg.apiKey ?? existing?.key,
        options: { ...existing?.options, ...providerCfg.options },
        models: { ...existing?.models },
      };
    }

    initialized = true;
  }

  export async function list(): Promise<Record<string, Info>> {
    if (!initialized) await init({});
    return providers;
  }

  export async function getProvider(providerID: string): Promise<Info> {
    const all = await list();
    const provider = all[providerID];
    if (!provider) throw new Error(`Provider "${providerID}" not found`);
    return provider;
  }

  export async function getModel(providerID: string, modelID: string): Promise<Model> {
    const provider = await getProvider(providerID);
    const model = provider.models[modelID];
    if (!model) {
      const available = Object.keys(provider.models);
      const matches = fuzzysort.go(modelID, available, { limit: 3, threshold: -10000 });
      const suggestions = matches.map((m) => m.target);
      throw new ModelNotFoundError(providerID, modelID, suggestions);
    }
    return model;
  }

  export async function getLanguage(model: Model): Promise<LanguageModelV2> {
    const key = `${model.providerID}/${model.id}`;
    const cached = languages.get(key);
    if (cached) return cached;

    const provider = await getProvider(model.providerID);
    const options: Record<string, any> = { ...provider.options };

    if (!options["baseURL"] && model.api.url) options["baseURL"] = model.api.url;
    if (options["apiKey"] === undefined && provider.key) options["apiKey"] = provider.key;
    if (model.headers) {
      options["headers"] = { ...options["headers"], ...model.headers };
    }

    const bundledFn = BUNDLED_PROVIDERS[model.api.npm];
    if (!bundledFn) {
      throw new Error(
        `No bundled provider for ${model.api.npm}. Register it with registerBundledProvider().`,
      );
    }

    const sdk = bundledFn({
      name: model.providerID,
      ...options,
    });

    const language = sdk.languageModel(model.api.id);
    languages.set(key, language);
    return language;
  }

  export function parseModel(model: string): { providerID: string; modelID: string } {
    const [providerID, ...rest] = model.split("/");
    return {
      providerID,
      modelID: rest.join("/"),
    };
  }

  export async function defaultModel(): Promise<{ providerID: string; modelID: string }> {
    const all = await list();
    const provider = Object.values(all)[0];
    if (!provider) throw new Error("No providers found");
    const models = Object.values(provider.models);
    if (models.length === 0) throw new Error("No models found");
    return {
      providerID: provider.id,
      modelID: models[0].id,
    };
  }

  export async function getSmallModel(providerID: string): Promise<Model | undefined> {
    const all = await list();
    const provider = all[providerID];
    if (!provider) return undefined;

    const priority = ["claude-haiku-4-5", "claude-3-5-haiku", "gemini-2.5-flash", "gpt-4o-mini"];
    for (const item of priority) {
      for (const modelID of Object.keys(provider.models)) {
        if (modelID.includes(item)) return provider.models[modelID];
      }
    }
    return undefined;
  }

  export class ModelNotFoundError extends Error {
    constructor(
      public readonly providerID: string,
      public readonly modelID: string,
      public readonly suggestions: string[] = [],
    ) {
      super(
        `Model "${modelID}" not found for provider "${providerID}"` +
          (suggestions.length ? `. Did you mean: ${suggestions.join(", ")}?` : ""),
      );
      this.name = "ModelNotFoundError";
    }
  }
}
