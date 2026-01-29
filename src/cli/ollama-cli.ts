import type { Command } from "commander";

import { ollamaSetupCommand } from "../commands/ollama-setup.js";
import { defaultRuntime } from "../runtime.js";
import { runCommandWithRuntime } from "./cli-utils.js";

function runOllamaCommand(action: () => Promise<void>) {
  return runCommandWithRuntime(defaultRuntime, action);
}

export function registerOllamaCli(program: Command) {
  const ollama = program.command("ollama").description("Ollama integration");

  ollama
    .command("setup")
    .description("Discover local Ollama models and write provider config")
    .option("--base-url <url>", "Ollama base URL (default: http://127.0.0.1:11434)")
    .option("--set-default", "Set the first discovered model as the default", false)
    .option("--yes", "Skip confirmation prompts", false)
    .action(async (opts) => {
      await runOllamaCommand(async () => {
        await ollamaSetupCommand(
          {
            baseUrl: opts.baseUrl as string | undefined,
            setDefault: Boolean(opts.setDefault),
            yes: Boolean(opts.yes),
          },
          defaultRuntime,
        );
      });
    });
}
