import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveGatewayStateDir } from "./paths.js";

describe("resolveGatewayStateDir", () => {
  it("uses the default state dir when no overrides are set", () => {
    const env = { HOME: "/Users/test" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".mrbeanbot"));
  });

  it("appends the profile suffix when set", () => {
    const env = { HOME: "/Users/test", MRBEANBOT_PROFILE: "rescue" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".mrbeanbot-rescue"));
  });

  it("treats default profiles as the base state dir", () => {
    const env = { HOME: "/Users/test", MRBEANBOT_PROFILE: "Default" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".mrbeanbot"));
  });

  it("uses MRBEANBOT_STATE_DIR when provided", () => {
    const env = { HOME: "/Users/test", MRBEANBOT_STATE_DIR: "/var/lib/mrbeanbot" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/var/lib/mrbeanbot"));
  });

  it("expands ~ in MRBEANBOT_STATE_DIR", () => {
    const env = { HOME: "/Users/test", MRBEANBOT_STATE_DIR: "~/MrBeanBot-state" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/Users/test/MrBeanBot-state"));
  });

  it("preserves Windows absolute paths without HOME", () => {
    const env = { MRBEANBOT_STATE_DIR: "C:\\State\\MrBeanBot" };
    expect(resolveGatewayStateDir(env)).toBe("C:\\State\\MrBeanBot");
  });
});
