import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  resolveDefaultConfigCandidates,
  resolveOAuthDir,
  resolveOAuthPath,
  resolveStateDir,
} from "./paths.js";

describe("oauth paths", () => {
  it("prefers MRBEANBOT_OAUTH_DIR over MRBEANBOT_STATE_DIR", () => {
    const env = {
      MRBEANBOT_OAUTH_DIR: "/custom/oauth",
      MRBEANBOT_STATE_DIR: "/custom/state",
    } as NodeJS.ProcessEnv;

    expect(resolveOAuthDir(env, "/custom/state")).toBe(path.resolve("/custom/oauth"));
    expect(resolveOAuthPath(env, "/custom/state")).toBe(
      path.join(path.resolve("/custom/oauth"), "oauth.json"),
    );
  });

  it("derives oauth path from MRBEANBOT_STATE_DIR when unset", () => {
    const env = {
      MRBEANBOT_STATE_DIR: "/custom/state",
    } as NodeJS.ProcessEnv;

    expect(resolveOAuthDir(env, "/custom/state")).toBe(path.join("/custom/state", "credentials"));
    expect(resolveOAuthPath(env, "/custom/state")).toBe(
      path.join("/custom/state", "credentials", "oauth.json"),
    );
  });
});

describe("state + config path candidates", () => {
  it("prefers MRBEANBOT_STATE_DIR over legacy state dir env", () => {
    const env = {
      MRBEANBOT_STATE_DIR: "/new/state",
      CLAWDBOT_STATE_DIR: "/legacy/state",
    } as NodeJS.ProcessEnv;

    expect(resolveStateDir(env, () => "/home/test")).toBe(path.resolve("/new/state"));
  });

  it("orders default config candidates as new then legacy", () => {
    const home = "/home/test";
    const candidates = resolveDefaultConfigCandidates({} as NodeJS.ProcessEnv, () => home);
    expect(candidates[0]).toBe(path.join(home, ".mrbeanbot", "mrbeanbot.json"));
    expect(candidates[1]).toBe(path.join(home, ".mrbeanbot", "moltbot.json"));
    expect(candidates[2]).toBe(path.join(home, ".mrbeanbot", "clawdbot.json"));
    expect(candidates[3]).toBe(path.join(home, ".moltbot", "mrbeanbot.json"));
  });

  it("prefers ~/.mrbeanbot when it exists and legacy dir is missing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mrbeanbot-state-"));
    try {
      const newDir = path.join(root, ".mrbeanbot");
      await fs.mkdir(newDir, { recursive: true });
      const resolved = resolveStateDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("CONFIG_PATH prefers existing legacy filename when present", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mrbeanbot-config-"));
    const previousHome = process.env.HOME;
    const previousMrBeanBotConfig = process.env.MRBEANBOT_CONFIG_PATH;
    const previousClawdBotConfig = process.env.CLAWDBOT_CONFIG_PATH;
    const previousMrBeanBotState = process.env.MRBEANBOT_STATE_DIR;
    const previousClawdBotState = process.env.CLAWDBOT_STATE_DIR;
    try {
      const legacyDir = path.join(root, ".clawdbot");
      await fs.mkdir(legacyDir, { recursive: true });
      const legacyPath = path.join(legacyDir, "clawdbot.json");
      await fs.writeFile(legacyPath, "{}", "utf-8");

      process.env.HOME = root;
      delete process.env.MRBEANBOT_CONFIG_PATH;
      delete process.env.CLAWDBOT_CONFIG_PATH;
      delete process.env.MRBEANBOT_STATE_DIR;
      delete process.env.CLAWDBOT_STATE_DIR;

      vi.resetModules();
      const { CONFIG_PATH } = await import("./paths.js");
      expect(CONFIG_PATH).toBe(legacyPath);
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
      if (previousMrBeanBotConfig === undefined) delete process.env.MRBEANBOT_CONFIG_PATH;
      else process.env.MRBEANBOT_CONFIG_PATH = previousMrBeanBotConfig;
      if (previousClawdBotConfig === undefined) delete process.env.CLAWDBOT_CONFIG_PATH;
      else process.env.CLAWDBOT_CONFIG_PATH = previousClawdBotConfig;
      if (previousMrBeanBotState === undefined) delete process.env.MRBEANBOT_STATE_DIR;
      else process.env.MRBEANBOT_STATE_DIR = previousMrBeanBotState;
      if (previousClawdBotState === undefined) delete process.env.CLAWDBOT_STATE_DIR;
      else process.env.CLAWDBOT_STATE_DIR = previousClawdBotState;
      await fs.rm(root, { recursive: true, force: true });
      vi.resetModules();
    }
  });
});
