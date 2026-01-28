import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "MrBeanBot",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) throw new Error(res.error);
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "MrBeanBot", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "MrBeanBot", "--dev", "gateway"]);
    if (!res.ok) throw new Error(res.error);
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "MrBeanBot", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "MrBeanBot", "--profile", "work", "status"]);
    if (!res.ok) throw new Error(res.error);
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "MrBeanBot", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "MrBeanBot", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (dev first)", () => {
    const res = parseCliProfileArgs(["node", "MrBeanBot", "--dev", "--profile", "work", "status"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (profile first)", () => {
    const res = parseCliProfileArgs(["node", "MrBeanBot", "--profile", "work", "--dev", "status"]);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join("/home/peter", ".mrbeanbot-dev");
    expect(env.MRBEANBOT_PROFILE).toBe("dev");
    expect(env.MRBEANBOT_STATE_DIR).toBe(expectedStateDir);
    expect(env.MRBEANBOT_CONFIG_PATH).toBe(path.join(expectedStateDir, "mrbeanbot.json"));
    expect(env.MRBEANBOT_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      MRBEANBOT_STATE_DIR: "/custom",
      MRBEANBOT_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.MRBEANBOT_STATE_DIR).toBe("/custom");
    expect(env.MRBEANBOT_GATEWAY_PORT).toBe("19099");
    expect(env.MRBEANBOT_CONFIG_PATH).toBe(path.join("/custom", "mrbeanbot.json"));
  });
});

describe("formatCliCommand", () => {
  it("returns command unchanged when no profile is set", () => {
    expect(formatCliCommand("MrBeanBot doctor --fix", {})).toBe("mrbeanbot doctor --fix");
  });

  it("returns command unchanged when profile is default", () => {
    expect(formatCliCommand("MrBeanBot doctor --fix", { MRBEANBOT_PROFILE: "default" })).toBe(
      "mrbeanbot doctor --fix",
    );
  });

  it("returns command unchanged when profile is Default (case-insensitive)", () => {
    expect(formatCliCommand("MrBeanBot doctor --fix", { MRBEANBOT_PROFILE: "Default" })).toBe(
      "mrbeanbot doctor --fix",
    );
  });

  it("returns command unchanged when profile is invalid", () => {
    expect(formatCliCommand("MrBeanBot doctor --fix", { MRBEANBOT_PROFILE: "bad profile" })).toBe(
      "mrbeanbot doctor --fix",
    );
  });

  it("returns command unchanged when --profile is already present", () => {
    expect(
      formatCliCommand("MrBeanBot --profile work doctor --fix", { MRBEANBOT_PROFILE: "work" }),
    ).toBe("mrbeanbot --profile work doctor --fix");
  });

  it("returns command unchanged when --dev is already present", () => {
    expect(formatCliCommand("MrBeanBot --dev doctor", { MRBEANBOT_PROFILE: "dev" })).toBe(
      "mrbeanbot --dev doctor",
    );
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("MrBeanBot doctor --fix", { MRBEANBOT_PROFILE: "work" })).toBe(
      "mrbeanbot --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("MrBeanBot doctor --fix", { MRBEANBOT_PROFILE: "  jbclawd  " })).toBe(
      "mrbeanbot --profile jbclawd doctor --fix",
    );
  });

  it("handles command with no args after MrBeanBot", () => {
    expect(formatCliCommand("MrBeanBot", { MRBEANBOT_PROFILE: "test" })).toBe(
      "mrbeanbot --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm MrBeanBot doctor", { MRBEANBOT_PROFILE: "work" })).toBe(
      "pnpm mrbeanbot --profile work doctor",
    );
  });
});
