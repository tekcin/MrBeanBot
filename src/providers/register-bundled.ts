/**
 * Registers all bundled AI SDK provider factories.
 * Call this once during app startup.
 */
import { Provider } from "./provider.js";

export async function registerBundledProviders() {
  // Each import is dynamic to avoid loading unused providers
  const registrations: Array<[string, () => Promise<any>]> = [
    ["@ai-sdk/anthropic", () => import("@ai-sdk/anthropic").then((m) => m.createAnthropic)],
    ["@ai-sdk/openai", () => import("@ai-sdk/openai").then((m) => m.createOpenAI)],
    ["@ai-sdk/google", () => import("@ai-sdk/google").then((m) => m.createGoogleGenerativeAI)],
    ["@ai-sdk/google-vertex", () => import("@ai-sdk/google-vertex").then((m) => m.createVertex)],
    [
      "@ai-sdk/amazon-bedrock",
      () => import("@ai-sdk/amazon-bedrock").then((m) => m.createAmazonBedrock),
    ],
    ["@ai-sdk/azure", () => import("@ai-sdk/azure").then((m) => m.createAzure)],
    ["@ai-sdk/xai", () => import("@ai-sdk/xai").then((m) => m.createXai)],
    ["@ai-sdk/mistral", () => import("@ai-sdk/mistral").then((m) => m.createMistral)],
    ["@ai-sdk/groq", () => import("@ai-sdk/groq").then((m) => m.createGroq)],
    ["@ai-sdk/deepinfra", () => import("@ai-sdk/deepinfra").then((m) => m.createDeepInfra)],
    ["@ai-sdk/cerebras", () => import("@ai-sdk/cerebras").then((m) => m.createCerebras)],
    ["@ai-sdk/cohere", () => import("@ai-sdk/cohere").then((m) => m.createCohere)],
    ["@ai-sdk/togetherai", () => import("@ai-sdk/togetherai").then((m) => m.createTogetherAI)],
    ["@ai-sdk/perplexity", () => import("@ai-sdk/perplexity").then((m) => m.createPerplexity)],
    ["@ai-sdk/vercel", () => import("@ai-sdk/vercel").then((m) => m.createVercel)],
    ["@ai-sdk/gateway", () => import("@ai-sdk/gateway").then((m) => m.createGateway)],
    [
      "@ai-sdk/openai-compatible",
      () => import("@ai-sdk/openai-compatible").then((m) => m.createOpenAICompatible),
    ],
    [
      "@openrouter/ai-sdk-provider",
      () => import("@openrouter/ai-sdk-provider").then((m) => m.createOpenRouter),
    ],
  ];

  for (const [npmPackage, loader] of registrations) {
    try {
      const factory = await loader();
      Provider.registerBundledProvider(npmPackage, factory);
    } catch {
      // Package not installed — skip silently
    }
  }
}
