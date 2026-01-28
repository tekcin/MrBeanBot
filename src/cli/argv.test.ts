import { describe, expect, it } from "vitest";

import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it("detects help/version flags", () => {
    expect(hasHelpOrVersion(["node", "MrBeanBot", "--help"])).toBe(true);
    expect(hasHelpOrVersion(["node", "MrBeanBot", "-V"])).toBe(true);
    expect(hasHelpOrVersion(["node", "MrBeanBot", "status"])).toBe(false);
  });

  it("extracts command path ignoring flags and terminator", () => {
    expect(getCommandPath(["node", "MrBeanBot", "status", "--json"], 2)).toEqual(["status"]);
    expect(getCommandPath(["node", "MrBeanBot", "agents", "list"], 2)).toEqual(["agents", "list"]);
    expect(getCommandPath(["node", "MrBeanBot", "status", "--", "ignored"], 2)).toEqual(["status"]);
  });

  it("returns primary command", () => {
    expect(getPrimaryCommand(["node", "MrBeanBot", "agents", "list"])).toBe("agents");
    expect(getPrimaryCommand(["node", "MrBeanBot"])).toBeNull();
  });

  it("parses boolean flags and ignores terminator", () => {
    expect(hasFlag(["node", "MrBeanBot", "status", "--json"], "--json")).toBe(true);
    expect(hasFlag(["node", "MrBeanBot", "--", "--json"], "--json")).toBe(false);
  });

  it("extracts flag values with equals and missing values", () => {
    expect(getFlagValue(["node", "MrBeanBot", "status", "--timeout", "5000"], "--timeout")).toBe(
      "5000",
    );
    expect(getFlagValue(["node", "MrBeanBot", "status", "--timeout=2500"], "--timeout")).toBe(
      "2500",
    );
    expect(getFlagValue(["node", "MrBeanBot", "status", "--timeout"], "--timeout")).toBeNull();
    expect(getFlagValue(["node", "MrBeanBot", "status", "--timeout", "--json"], "--timeout")).toBe(
      null,
    );
    expect(getFlagValue(["node", "MrBeanBot", "--", "--timeout=99"], "--timeout")).toBeUndefined();
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "MrBeanBot", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "MrBeanBot", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "MrBeanBot", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it("parses positive integer flag values", () => {
    expect(getPositiveIntFlagValue(["node", "MrBeanBot", "status"], "--timeout")).toBeUndefined();
    expect(
      getPositiveIntFlagValue(["node", "MrBeanBot", "status", "--timeout"], "--timeout"),
    ).toBeNull();
    expect(
      getPositiveIntFlagValue(["node", "MrBeanBot", "status", "--timeout", "5000"], "--timeout"),
    ).toBe(5000);
    expect(
      getPositiveIntFlagValue(["node", "MrBeanBot", "status", "--timeout", "nope"], "--timeout"),
    ).toBeUndefined();
  });

  it("builds parse argv from raw args", () => {
    const nodeArgv = buildParseArgv({
      programName: "MrBeanBot",
      rawArgs: ["node", "MrBeanBot", "status"],
    });
    expect(nodeArgv).toEqual(["node", "MrBeanBot", "status"]);

    const versionedNodeArgv = buildParseArgv({
      programName: "MrBeanBot",
      rawArgs: ["node-22", "MrBeanBot", "status"],
    });
    expect(versionedNodeArgv).toEqual(["node-22", "MrBeanBot", "status"]);

    const versionedNodeWindowsArgv = buildParseArgv({
      programName: "MrBeanBot",
      rawArgs: ["node-22.2.0.exe", "MrBeanBot", "status"],
    });
    expect(versionedNodeWindowsArgv).toEqual(["node-22.2.0.exe", "MrBeanBot", "status"]);

    const versionedNodePatchlessArgv = buildParseArgv({
      programName: "MrBeanBot",
      rawArgs: ["node-22.2", "MrBeanBot", "status"],
    });
    expect(versionedNodePatchlessArgv).toEqual(["node-22.2", "MrBeanBot", "status"]);

    const versionedNodeWindowsPatchlessArgv = buildParseArgv({
      programName: "MrBeanBot",
      rawArgs: ["node-22.2.exe", "MrBeanBot", "status"],
    });
    expect(versionedNodeWindowsPatchlessArgv).toEqual(["node-22.2.exe", "MrBeanBot", "status"]);

    const versionedNodeWithPathArgv = buildParseArgv({
      programName: "MrBeanBot",
      rawArgs: ["/usr/bin/node-22.2.0", "MrBeanBot", "status"],
    });
    expect(versionedNodeWithPathArgv).toEqual(["/usr/bin/node-22.2.0", "MrBeanBot", "status"]);

    const nodejsArgv = buildParseArgv({
      programName: "MrBeanBot",
      rawArgs: ["nodejs", "MrBeanBot", "status"],
    });
    expect(nodejsArgv).toEqual(["nodejs", "MrBeanBot", "status"]);

    const nonVersionedNodeArgv = buildParseArgv({
      programName: "MrBeanBot",
      rawArgs: ["node-dev", "MrBeanBot", "status"],
    });
    expect(nonVersionedNodeArgv).toEqual(["node", "MrBeanBot", "node-dev", "MrBeanBot", "status"]);

    const directArgv = buildParseArgv({
      programName: "MrBeanBot",
      rawArgs: ["MrBeanBot", "status"],
    });
    expect(directArgv).toEqual(["node", "MrBeanBot", "status"]);

    const bunArgv = buildParseArgv({
      programName: "MrBeanBot",
      rawArgs: ["bun", "src/entry.ts", "status"],
    });
    expect(bunArgv).toEqual(["bun", "src/entry.ts", "status"]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "MrBeanBot",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "MrBeanBot", "status"]);
  });

  it("decides when to migrate state", () => {
    expect(shouldMigrateState(["node", "MrBeanBot", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "MrBeanBot", "health"])).toBe(false);
    expect(shouldMigrateState(["node", "MrBeanBot", "sessions"])).toBe(false);
    expect(shouldMigrateState(["node", "MrBeanBot", "memory", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "MrBeanBot", "agent", "--message", "hi"])).toBe(false);
    expect(shouldMigrateState(["node", "MrBeanBot", "agents", "list"])).toBe(true);
    expect(shouldMigrateState(["node", "MrBeanBot", "message", "send"])).toBe(true);
  });

  it("reuses command path for migrate state decisions", () => {
    expect(shouldMigrateStateFromPath(["status"])).toBe(false);
    expect(shouldMigrateStateFromPath(["agents", "list"])).toBe(true);
  });
});
