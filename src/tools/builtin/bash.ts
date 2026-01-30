/**
 * Bash tool ported from OpenCode.
 * Executes shell commands with timeout and abort support.
 */
import z from "zod";
import { spawn } from "node:child_process";
import { Tool } from "../tool.js";

const DEFAULT_TIMEOUT = 2 * 60 * 1000; // 2 minutes
const MAX_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const MAX_METADATA_LENGTH = 30_000;

const DESCRIPTION = `Executes a bash command with optional timeout.
- Commands run in a shell (bash or sh)
- Default timeout is 2 minutes (max 10 minutes)
- Provide a clear description of what the command does
- Output includes both stdout and stderr`;

export const BashTool = Tool.define("bash", {
  description: DESCRIPTION,
  parameters: z.object({
    command: z.string().describe("The command to execute"),
    timeout: z.number().describe("Optional timeout in milliseconds (max 600000)").optional(),
    description: z
      .string()
      .describe("Clear, concise 5-10 word description of the command")
      .optional(),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "bash",
      patterns: [params.command],
      always: [],
      metadata: {
        command: params.command,
        description: params.description,
      },
    });

    const timeout = Math.min(params.timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT);
    const shell = process.env.SHELL || "/bin/bash";

    const proc = spawn(params.command, {
      shell,
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });

    let output = "";
    const append = (chunk: Buffer) => {
      output += chunk.toString();
      ctx.metadata({
        metadata: {
          output:
            output.length > MAX_METADATA_LENGTH
              ? output.slice(0, MAX_METADATA_LENGTH) + "\n\n..."
              : output,
          description: params.description,
        },
      });
    };

    proc.stdout?.on("data", append);
    proc.stderr?.on("data", append);

    let timedOut = false;
    let aborted = false;
    let exited = false;

    const kill = () => {
      try {
        if (!exited && proc.pid) {
          // Kill process group
          if (process.platform !== "win32") {
            try {
              process.kill(-proc.pid, "SIGTERM");
            } catch {
              process.kill(proc.pid, "SIGTERM");
            }
          } else {
            proc.kill("SIGTERM");
          }
        }
      } catch {
        // Already dead
      }
    };

    if (ctx.abort.aborted) {
      aborted = true;
      kill();
    }

    const abortHandler = () => {
      aborted = true;
      kill();
    };
    ctx.abort.addEventListener("abort", abortHandler, { once: true });

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeout + 100);

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      proc.once("exit", (code) => {
        exited = true;
        clearTimeout(timeoutTimer);
        ctx.abort.removeEventListener("abort", abortHandler);
        resolve(code);
      });
      proc.once("error", (err) => {
        exited = true;
        clearTimeout(timeoutTimer);
        ctx.abort.removeEventListener("abort", abortHandler);
        reject(err);
      });
    });

    if (timedOut) {
      output += `\n\n<bash_metadata>\nbash tool terminated after ${timeout} ms\n</bash_metadata>`;
    }
    if (aborted) {
      output += "\n\n<bash_metadata>\nUser aborted\n</bash_metadata>";
    }

    return {
      title: params.description ?? params.command.slice(0, 50),
      metadata: {
        output:
          output.length > MAX_METADATA_LENGTH
            ? output.slice(0, MAX_METADATA_LENGTH) + "\n\n..."
            : output,
        exit: exitCode,
        description: params.description,
      },
      output,
    };
  },
});
