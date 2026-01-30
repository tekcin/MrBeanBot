/**
 * Compatibility adapter: bridges the existing `RunEmbeddedPiAgentParams` interface
 * to the new Vercel AI SDK streaming system.
 *
 * Drop-in replacement for `runEmbeddedPiAgent` that uses `streamText()` instead
 * of Pi's `streamSimple()`, enabling all existing call sites to switch to the
 * Vercel AI SDK without API changes.
 *
 * Provenance: this adapter wraps the new LLM/Provider modules ported from OpenCode
 * while preserving the Pi runner's external contract (params, callbacks, return type).
 */
import fs from "node:fs/promises";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import { streamText, wrapLanguageModel, extractReasoningMiddleware } from "ai";
import { Bus } from "../bus/index.js";
import { MessageV2 } from "../sessions/message-v2.js";
import { Identifier } from "../id/id.js";
import { BusEvent } from "../bus/bus-event.js";
import z from "zod";

import type { RunEmbeddedPiAgentParams } from "./pi-embedded-runner/run/params.js";
import type { EmbeddedPiAgentMeta, EmbeddedPiRunResult } from "./pi-embedded-runner/types.js";
import { enqueueCommandInLane } from "../process/command-queue.js";
import { resolveUserPath } from "../utils.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "./defaults.js";
import { resolveMrBeanBotAgentDir } from "./agent-paths.js";
import {
  isProfileInCooldown,
  markAuthProfileFailure,
  markAuthProfileGood,
  markAuthProfileUsed,
} from "./auth-profiles.js";
import {
  ensureAuthProfileStore,
  getApiKeyForModel,
  resolveAuthProfileOrder,
  type ResolvedProviderAuth,
} from "./model-auth.js";
import { normalizeProviderId } from "./model-selection.js";
import {
  classifyFailoverReason,
  isCompactionFailureError,
  isContextOverflowError,
  isFailoverErrorMessage,
  pickFallbackThinkingLevel,
} from "./pi-embedded-helpers.js";
import { FailoverError, resolveFailoverStatus } from "./failover-error.js";
import { resolveGlobalLane, resolveSessionLane } from "./pi-embedded-runner/lanes.js";
import { log } from "./pi-embedded-runner/logger.js";
import { describeUnknownError } from "./pi-embedded-runner/utils.js";
import type { ThinkLevel } from "../auto-reply/thinking.js";

/**
 * Creates a Vercel AI SDK language model from MrBeanBot's provider/model strings
 * and the resolved API key. Dynamically imports the appropriate @ai-sdk/* package.
 */
async function createLanguageModel(
  providerId: string,
  modelId: string,
  apiKey: string | undefined,
  baseUrl?: string,
): Promise<LanguageModelV2> {
  const normalizedProvider = normalizeProviderId(providerId);
  const sdkPackageMap: Record<string, string> = {
    anthropic: "@ai-sdk/anthropic",
    openai: "@ai-sdk/openai",
    google: "@ai-sdk/google",
    "google-vertex": "@ai-sdk/google-vertex",
    bedrock: "@ai-sdk/amazon-bedrock",
    "amazon-bedrock": "@ai-sdk/amazon-bedrock",
    azure: "@ai-sdk/azure",
    xai: "@ai-sdk/xai",
    mistral: "@ai-sdk/mistral",
    groq: "@ai-sdk/groq",
    deepinfra: "@ai-sdk/deepinfra",
    cerebras: "@ai-sdk/cerebras",
    cohere: "@ai-sdk/cohere",
    togetherai: "@ai-sdk/togetherai",
    perplexity: "@ai-sdk/perplexity",
    openrouter: "@openrouter/ai-sdk-provider",
  };

  const packageName = sdkPackageMap[normalizedProvider];

  if (!packageName) {
    // Fallback: use openai-compatible for custom providers
    const mod = await import("@ai-sdk/openai-compatible");
    const providerOpts: Record<string, unknown> = { name: normalizedProvider };
    if (apiKey) providerOpts["apiKey"] = apiKey;
    if (baseUrl) providerOpts["baseURL"] = baseUrl;
    const provider = mod.createOpenAICompatible(providerOpts as any);
    return provider.languageModel(modelId) as unknown as LanguageModelV2;
  }

  // Dynamic import of the provider package
  const mod: Record<string, unknown> = await import(packageName);
  const createFn =
    mod["createAnthropic"] ??
    mod["createOpenAI"] ??
    mod["createGoogle"] ??
    mod["createGoogleGenerativeAI"] ??
    mod["createVertex"] ??
    mod["createAmazonBedrock"] ??
    mod["createAzure"] ??
    mod["createXai"] ??
    mod["createMistral"] ??
    mod["createGroq"] ??
    mod["createDeepInfra"] ??
    mod["createCerebras"] ??
    mod["createCohere"] ??
    mod["createTogetherAI"] ??
    mod["createPerplexity"] ??
    mod["createOpenRouter"] ??
    mod["default"];

  if (typeof createFn !== "function") {
    throw new Error(`Provider package "${packageName}" does not export a create function.`);
  }

  const options: Record<string, unknown> = {};
  if (apiKey) options["apiKey"] = apiKey;
  if (baseUrl) options["baseURL"] = baseUrl;

  const sdk = createFn(options) as Record<string, unknown>;
  const languageFn = sdk["languageModel"] ?? sdk["chat"] ?? sdk;
  if (typeof languageFn === "function") {
    return languageFn(modelId) as LanguageModelV2;
  }
  return (createFn(options) as (id: string) => LanguageModelV2)(modelId);
}

const SessionErrorEvent = BusEvent.define(
  "session.error",
  z.object({
    sessionID: z.string().optional(),
    error: z.object({ name: z.string(), message: z.string() }),
  }),
);

type EnqueueOpts = {
  warnAfterMs?: number;
  onWait?: (waitMs: number, queuedAhead: number) => void;
};

/**
 * Run an embedded agent using Vercel AI SDK streaming.
 * Drop-in replacement for the Pi-based `runEmbeddedPiAgent`.
 */
export async function runVercelEmbeddedAgent(
  params: RunEmbeddedPiAgentParams,
): Promise<EmbeddedPiRunResult> {
  const sessionLane = resolveSessionLane(params.sessionKey?.trim() || params.sessionId);
  const globalLane = resolveGlobalLane(params.lane);
  const enqueueGlobal =
    params.enqueue ??
    (<T>(task: () => Promise<T>, opts?: EnqueueOpts) =>
      enqueueCommandInLane(globalLane, task, opts));
  const enqueueSession =
    params.enqueue ??
    (<T>(task: () => Promise<T>, opts?: EnqueueOpts) =>
      enqueueCommandInLane(sessionLane, task, opts));

  return enqueueSession<EmbeddedPiRunResult>(() =>
    enqueueGlobal<EmbeddedPiRunResult>(async (): Promise<EmbeddedPiRunResult> => {
      const started = Date.now();
      const resolvedWorkspace = resolveUserPath(params.workspaceDir);
      const prevCwd = process.cwd();

      const provider = (params.provider ?? DEFAULT_PROVIDER).trim() || DEFAULT_PROVIDER;
      const modelId = (params.model ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
      const agentDir = params.agentDir ?? resolveMrBeanBotAgentDir();
      const fallbackConfigured =
        (params.config?.agents?.defaults?.model?.fallbacks?.length ?? 0) > 0;

      // Auth profile resolution (reuse existing infrastructure)
      const authStore = ensureAuthProfileStore(agentDir, { allowKeychainPrompt: false });
      const preferredProfileId = params.authProfileId?.trim();
      let lockedProfileId = params.authProfileIdSource === "user" ? preferredProfileId : undefined;
      if (lockedProfileId) {
        const lockedProfile = authStore.profiles[lockedProfileId];
        if (
          !lockedProfile ||
          normalizeProviderId(lockedProfile.provider) !== normalizeProviderId(provider)
        ) {
          lockedProfileId = undefined;
        }
      }
      const profileOrder = resolveAuthProfileOrder({
        cfg: params.config,
        store: authStore,
        provider,
        preferredProfile: preferredProfileId,
      });
      const profileCandidates = lockedProfileId
        ? [lockedProfileId]
        : profileOrder.length > 0
          ? profileOrder
          : [undefined];
      let profileIndex = 0;

      const initialThinkLevel = params.thinkLevel ?? "off";
      let thinkLevel: ThinkLevel = initialThinkLevel;
      const attemptedThinking = new Set<ThinkLevel>();
      let resolvedApiKey: string | undefined;
      let lastProfileId: string | undefined;

      const resolveApiKeyForCandidate = async (candidate?: string) => {
        return getApiKeyForModel({
          model: { provider: normalizeProviderId(provider), id: modelId } as any,
          cfg: params.config,
          profileId: candidate,
          store: authStore,
          agentDir,
        });
      };

      const applyApiKeyInfo = async (candidate?: string): Promise<void> => {
        const info: ResolvedProviderAuth = await resolveApiKeyForCandidate(candidate);
        resolvedApiKey = info.apiKey;
        const resolvedProfileId = info.profileId ?? candidate;
        if (!info.apiKey && info.mode !== "aws-sdk") {
          throw new Error(
            `No API key resolved for provider "${provider}" (auth mode: ${info.mode}).`,
          );
        }
        lastProfileId = resolvedProfileId;
      };

      const advanceAuthProfile = async (): Promise<boolean> => {
        if (lockedProfileId) return false;
        let nextIndex = profileIndex + 1;
        while (nextIndex < profileCandidates.length) {
          const candidate = profileCandidates[nextIndex];
          if (candidate && isProfileInCooldown(authStore, candidate)) {
            nextIndex += 1;
            continue;
          }
          try {
            await applyApiKeyInfo(candidate);
            profileIndex = nextIndex;
            thinkLevel = initialThinkLevel;
            attemptedThinking.clear();
            return true;
          } catch {
            nextIndex += 1;
          }
        }
        return false;
      };

      // Resolve initial auth profile
      try {
        while (profileIndex < profileCandidates.length) {
          const candidate = profileCandidates[profileIndex];
          if (
            candidate &&
            candidate !== lockedProfileId &&
            isProfileInCooldown(authStore, candidate)
          ) {
            profileIndex += 1;
            continue;
          }
          await applyApiKeyInfo(profileCandidates[profileIndex]);
          break;
        }
        if (profileIndex >= profileCandidates.length) {
          const message = `No available auth profile for ${provider} (all in cooldown or unavailable).`;
          if (fallbackConfigured) {
            throw new FailoverError(message, { reason: "auth", provider, model: modelId });
          }
          throw new Error(message);
        }
      } catch (err) {
        if (err instanceof FailoverError) throw err;
        const advanced = await advanceAuthProfile();
        if (!advanced) {
          const message = `No available auth profile for ${provider}.`;
          if (fallbackConfigured) {
            throw new FailoverError(message, { reason: "auth", provider, model: modelId });
          }
          throw err;
        }
      }

      try {
        while (true) {
          attemptedThinking.add(thinkLevel);
          await fs.mkdir(resolvedWorkspace, { recursive: true });

          const sessionID = params.sessionKey ?? params.sessionId;
          const runId = params.runId;
          let aborted = false;
          let accumulatedText = "";
          let tokenUsage: { input: number; output: number } | undefined;

          // Set up abort handling
          const abortController = new AbortController();
          const externalSignal = params.abortSignal;
          if (externalSignal) {
            if (externalSignal.aborted) {
              abortController.abort();
              aborted = true;
            } else {
              externalSignal.addEventListener("abort", () => {
                abortController.abort();
                aborted = true;
              });
            }
          }

          // Timeout handling
          let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
          if (params.timeoutMs > 0) {
            timeoutHandle = setTimeout(() => {
              abortController.abort();
              aborted = true;
            }, params.timeoutMs);
          }

          try {
            // Create the Vercel AI SDK language model
            const providerBaseUrl =
              params.config?.models?.providers?.[provider]?.baseUrl ??
              params.config?.models?.providers?.[normalizeProviderId(provider)]?.baseUrl;
            const language = await createLanguageModel(
              provider,
              modelId,
              resolvedApiKey,
              providerBaseUrl,
            );

            // Build system prompt
            const systemMessages: Array<{ role: "system"; content: string }> = [];
            if (params.extraSystemPrompt) {
              systemMessages.push({ role: "system", content: params.extraSystemPrompt });
            }

            // Build messages
            const messages = [...systemMessages, { role: "user" as const, content: params.prompt }];

            // Emit lifecycle start
            params.onAgentEvent?.({
              stream: "lifecycle",
              data: { phase: "start", startedAt: Date.now() },
            });

            // Notify assistant message start
            await params.onAssistantMessageStart?.();

            // Create stream with optional reasoning middleware
            const useReasoning = thinkLevel !== "off";
            const model = useReasoning
              ? wrapLanguageModel({
                  model: language,
                  middleware: [
                    extractReasoningMiddleware({ tagName: "think", startWithReasoning: false }),
                  ],
                })
              : language;

            const maxOutputTokens = params.streamParams?.maxTokens ?? 32_000;

            const stream = streamText({
              model,
              messages,
              maxOutputTokens,
              abortSignal: abortController.signal,
              maxRetries: 0,
              headers: {
                "User-Agent": "mrbeanbot/1.0",
              },
            });

            // Process the stream
            // Note: tool-call and tool-result events are only available when tools
            // are registered with streamText(). The adapter currently streams without
            // tools, so those events are handled via type assertion for future use.
            for await (const value of stream.fullStream) {
              if (aborted) break;

              const event = value as { type: string; [key: string]: unknown };

              switch (event.type) {
                case "text-delta":
                  // ai v5: text-delta events use "text" property (not "textDelta")
                  accumulatedText += (event["text"] as string) ?? "";
                  if (params.onPartialReply) {
                    await params.onPartialReply({ text: accumulatedText });
                  }
                  if (params.onBlockReply) {
                    await params.onBlockReply({ text: accumulatedText });
                  }
                  void Bus.publish(MessageV2.Event.PartUpdated, {
                    part: {
                      id: Identifier.ascending("part"),
                      messageID: runId,
                      sessionID,
                      type: "text" as const,
                      text: accumulatedText,
                    },
                    delta: (event["text"] as string) ?? "",
                  });
                  break;

                case "reasoning":
                case "reasoning-delta":
                  // ai v5: reasoning-delta events use "text" property
                  if (params.onReasoningStream) {
                    await params.onReasoningStream({
                      text: (event["text"] as string) ?? "",
                    });
                  }
                  break;

                case "tool-call":
                  params.onAgentEvent?.({
                    stream: "tool",
                    data: {
                      phase: "start",
                      tool: (event["toolName"] as string) ?? "",
                      input: (event["args"] as Record<string, unknown>) ?? {},
                    },
                  });
                  break;

                case "tool-result":
                  params.onAgentEvent?.({
                    stream: "tool",
                    data: {
                      phase: "end",
                      tool: (event["toolName"] as string) ?? "",
                      output: (event["result"] as Record<string, unknown>) ?? {},
                    },
                  });
                  if (params.onToolResult) {
                    const result = event["result"];
                    const outputStr = typeof result === "string" ? result : JSON.stringify(result);
                    await params.onToolResult({ text: outputStr });
                  }
                  break;

                case "step-finish":
                  tokenUsage = {
                    input: ((event["usage"] as any)?.promptTokens as number) ?? 0,
                    output: ((event["usage"] as any)?.completionTokens as number) ?? 0,
                  };
                  break;

                case "error":
                  throw event["error"];

                default:
                  break;
              }
            }

            // Emit lifecycle end
            params.onAgentEvent?.({
              stream: "lifecycle",
              data: {
                phase: aborted ? "error" : "end",
                startedAt: started,
                endedAt: Date.now(),
                aborted,
              },
            });

            // Mark auth profile as good
            if (lastProfileId) {
              await markAuthProfileGood({
                store: authStore,
                provider,
                profileId: lastProfileId,
                agentDir,
              });
              await markAuthProfileUsed({
                store: authStore,
                profileId: lastProfileId,
                agentDir,
              });
            }

            // Build payloads in the Pi format
            const payloads: NonNullable<EmbeddedPiRunResult["payloads"]> = [];
            const finalText = accumulatedText.trim();
            if (finalText) {
              payloads.push({ text: finalText });
            }

            const agentMeta: EmbeddedPiAgentMeta = {
              sessionId: params.sessionId,
              provider,
              model: modelId,
              usage: tokenUsage
                ? {
                    input: tokenUsage.input,
                    output: tokenUsage.output,
                    total: tokenUsage.input + tokenUsage.output,
                  }
                : undefined,
            };

            log.debug(
              `vercel run done: runId=${runId} sessionId=${params.sessionId} durationMs=${Date.now() - started} aborted=${aborted}`,
            );

            return {
              payloads: payloads.length > 0 ? payloads : undefined,
              meta: {
                durationMs: Date.now() - started,
                agentMeta,
                aborted,
              },
            };
          } catch (err) {
            const errorText = describeUnknownError(err);

            // Handle context overflow
            if (isContextOverflowError(errorText)) {
              const isCompaction = isCompactionFailureError(errorText);
              const kind = isCompaction ? "compaction_failure" : "context_overflow";
              return {
                payloads: [
                  {
                    text:
                      "Context overflow: prompt too large for the model. " +
                      "Try again with less input or a larger-context model.",
                    isError: true,
                  },
                ],
                meta: {
                  durationMs: Date.now() - started,
                  agentMeta: { sessionId: params.sessionId, provider, model: modelId },
                  error: { kind, message: errorText },
                },
              };
            }

            // Handle failover errors
            const failoverReason = classifyFailoverReason(errorText);
            if (failoverReason && failoverReason !== "timeout" && lastProfileId) {
              await markAuthProfileFailure({
                store: authStore,
                profileId: lastProfileId,
                reason: failoverReason,
                cfg: params.config,
                agentDir,
              });
            }

            // Try next auth profile
            if (
              isFailoverErrorMessage(errorText) &&
              failoverReason !== "timeout" &&
              (await advanceAuthProfile())
            ) {
              continue;
            }

            // Try fallback thinking level
            const fallbackThinking = pickFallbackThinkingLevel({
              message: errorText,
              attempted: attemptedThinking,
            });
            if (fallbackThinking) {
              log.warn(
                `unsupported thinking level for ${provider}/${modelId}; retrying with ${fallbackThinking}`,
              );
              thinkLevel = fallbackThinking;
              continue;
            }

            // Throw FailoverError for model fallback
            if (fallbackConfigured && isFailoverErrorMessage(errorText)) {
              throw new FailoverError(errorText, {
                reason: failoverReason ?? "unknown",
                provider,
                model: modelId,
                profileId: lastProfileId,
                status: resolveFailoverStatus(failoverReason ?? "unknown"),
              });
            }

            // Emit error lifecycle
            params.onAgentEvent?.({
              stream: "lifecycle",
              data: {
                phase: "error",
                startedAt: started,
                endedAt: Date.now(),
                error: errorText,
              },
            });

            // Publish error via Bus
            void Bus.publish(SessionErrorEvent, {
              sessionID: params.sessionKey ?? params.sessionId,
              error: {
                name: err instanceof Error ? err.constructor.name : "Error",
                message: errorText,
              },
            });

            throw err;
          } finally {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            process.chdir(prevCwd);
          }
        }
      } finally {
        process.chdir(prevCwd);
      }
    }),
  ) as Promise<EmbeddedPiRunResult>;
}
