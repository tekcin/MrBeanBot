import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createConfigIO } from "./io.js";

async function withTempHome(run: (home: string) => Promise<void>): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "mrbeanbot-config-"));
  try {
    await run(home);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
}

async function writeConfig(
  home: string,
  dirname: string,
  port: number,
  filename: string = "mrbeanbot.json",
) {
  const dir = path.join(home, dirname);
  await fs.mkdir(dir, { recursive: true });
  const configPath = path.join(dir, filename);
  await fs.writeFile(configPath, JSON.stringify({ gateway: { port } }, null, 2));
  return configPath;
}

describe("config io compat (new + legacy folders)", () => {
  it("loads config from ~/.mrbeanbot/mrbeanbot.json", async () => {
    await withTempHome(async (home) => {
      const configPath = await writeConfig(home, ".mrbeanbot", 19001);

      const io = createConfigIO({
        env: {} as NodeJS.ProcessEnv,
        homedir: () => home,
      });
      expect(io.configPath).toBe(configPath);
      expect(io.loadConfig().gateway?.port).toBe(19001);
    });
  });

  it("honors explicit config path env override", async () => {
    await withTempHome(async (home) => {
      const defaultConfigPath = await writeConfig(home, ".mrbeanbot", 19002);
      const customDir = path.join(home, "custom");
      await fs.mkdir(customDir, { recursive: true });
      const customConfigPath = path.join(customDir, "mrbeanbot.json");
      await fs.writeFile(customConfigPath, JSON.stringify({ gateway: { port: 20002 } }, null, 2));

      const io = createConfigIO({
        env: { MRBEANBOT_CONFIG_PATH: customConfigPath } as NodeJS.ProcessEnv,
        homedir: () => home,
      });

      expect(io.configPath).not.toBe(defaultConfigPath);
      expect(io.configPath).toBe(customConfigPath);
      expect(io.loadConfig().gateway?.port).toBe(20002);
    });
  });
});
