import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { MrBeanBotConfig } from "./types.js";

/**
 * Nix mode detection: When MRBEANBOT_NIX_MODE=1, the gateway is running under Nix.
 * In this mode:
 * - No auto-install flows should be attempted
 * - Missing dependencies should produce actionable Nix-specific error messages
 * - Config is managed externally (read-only from Nix perspective)
 */
export function resolveIsNixMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.MRBEANBOT_NIX_MODE === "1" ||
    env.MRBEANBOT_NIX_MODE === "1" ||
    env.MRBEANBOT_NIX_MODE === "1"
  );
}

export const isNixMode = resolveIsNixMode();

const STATE_DIRNAME = ".mrbeanbot";
const LEGACY_STATE_DIRNAMES = [".MrBeanBot", ".MrBeanBot"];
const CONFIG_FILENAME = "mrbeanbot.json";
const LEGACY_CONFIG_FILENAMES = ["MrBeanBot.json", "MrBeanBot.json"];

function currentStateDir(homedir: () => string = os.homedir): string {
  return path.join(homedir(), STATE_DIRNAME);
}

function legacyStateDir(homedir: () => string = os.homedir, index: number = 0): string {
  return path.join(homedir(), LEGACY_STATE_DIRNAMES[index]);
}

export function resolveLegacyStateDir(homedir: () => string = os.homedir): string {
  return legacyStateDir(homedir, 1); // .MrBeanBot
}

export function resolveNewStateDir(homedir: () => string = os.homedir): string {
  return legacyStateDir(homedir, 0); // .MrBeanBot
}

/**
 * State directory for mutable data (sessions, logs, caches).
 * Can be overridden via MRBEANBOT_STATE_DIR (preferred), MRBEANBOT_STATE_DIR, or MRBEANBOT_STATE_DIR (legacy).
 * Default: ~/.mrbeanbot (new default)
 * Falls back to existing legacy directories for backward compatibility.
 */
export function resolveStateDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  const override =
    env.MRBEANBOT_STATE_DIR?.trim() ||
    env.MRBEANBOT_STATE_DIR?.trim() ||
    env.MRBEANBOT_STATE_DIR?.trim();
  if (override) return resolveUserPath(override);

  const currentDir = currentStateDir(homedir);
  const MrBeanBotDir = legacyStateDir(homedir, 0);
  const MrBeanBotDir = legacyStateDir(homedir, 1);

  // Check if any legacy directory exists
  if (fs.existsSync(currentDir)) return currentDir;
  if (fs.existsSync(MrBeanBotDir)) return MrBeanBotDir;
  if (fs.existsSync(MrBeanBotDir)) return MrBeanBotDir;

  return currentDir;
}

function resolveUserPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("~")) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
}

export const STATE_DIR = resolveStateDir();

/**
 * Config file path (JSON5).
 * Can be overridden via MRBEANBOT_CONFIG_PATH (preferred), MRBEANBOT_CONFIG_PATH, or MRBEANBOT_CONFIG_PATH (legacy).
 * Default: ~/.mrbeanbot/mrbeanbot.json (or $*_STATE_DIR/mrbeanbot.json)
 */
export function resolveCanonicalConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, os.homedir),
): string {
  const override =
    env.MRBEANBOT_CONFIG_PATH?.trim() ||
    env.MRBEANBOT_CONFIG_PATH?.trim() ||
    env.MRBEANBOT_CONFIG_PATH?.trim();
  if (override) return resolveUserPath(override);
  return path.join(stateDir, CONFIG_FILENAME);
}

/**
 * Resolve the active config path by preferring existing config candidates
 * (new/legacy filenames) before falling back to the canonical path.
 */
export function resolveConfigPathCandidate(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  const candidates = resolveDefaultConfigCandidates(env, homedir);
  const existing = candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
  if (existing) return existing;
  return resolveCanonicalConfigPath(env, resolveStateDir(env, homedir));
}

/**
 * Active config path (prefers existing legacy/new config files).
 */
export function resolveConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, os.homedir),
  homedir: () => string = os.homedir,
): string {
  const override =
    env.MRBEANBOT_CONFIG_PATH?.trim() ||
    env.MRBEANBOT_CONFIG_PATH?.trim() ||
    env.MRBEANBOT_CONFIG_PATH?.trim();
  if (override) return resolveUserPath(override);
  const candidates = [
    path.join(stateDir, CONFIG_FILENAME),
    ...LEGACY_CONFIG_FILENAMES.map((fname) => path.join(stateDir, fname)),
  ];
  const existing = candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
  if (existing) return existing;
  const defaultStateDir = resolveStateDir(env, homedir);
  if (path.resolve(stateDir) === path.resolve(defaultStateDir)) {
    return resolveConfigPathCandidate(env, homedir);
  }
  return path.join(stateDir, CONFIG_FILENAME);
}

export const CONFIG_PATH = resolveConfigPathCandidate();

/**
 * Resolve default config path candidates across new + legacy locations.
 * Order: explicit config path → state-dir-derived paths → new default → legacy defaults.
 */
export function resolveDefaultConfigCandidates(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string[] {
  const explicit =
    env.MRBEANBOT_CONFIG_PATH?.trim() ||
    env.MRBEANBOT_CONFIG_PATH?.trim() ||
    env.MRBEANBOT_CONFIG_PATH?.trim();
  if (explicit) return [resolveUserPath(explicit)];

  const candidates: string[] = [];

  const mrbeanStateDir = env.MRBEANBOT_STATE_DIR?.trim();
  if (mrbeanStateDir) {
    candidates.push(path.join(resolveUserPath(mrbeanStateDir), CONFIG_FILENAME));
    for (const legacyName of LEGACY_CONFIG_FILENAMES) {
      candidates.push(path.join(resolveUserPath(mrbeanStateDir), legacyName));
    }
  }

  const MrBeanBotStateDir = env.MRBEANBOT_STATE_DIR?.trim();
  if (MrBeanBotStateDir) {
    candidates.push(path.join(resolveUserPath(MrBeanBotStateDir), CONFIG_FILENAME));
    for (const legacyName of LEGACY_CONFIG_FILENAMES) {
      candidates.push(path.join(resolveUserPath(MrBeanBotStateDir), legacyName));
    }
  }

  const legacyStateDirOverride = env.MRBEANBOT_STATE_DIR?.trim();
  if (legacyStateDirOverride) {
    candidates.push(path.join(resolveUserPath(legacyStateDirOverride), CONFIG_FILENAME));
    for (const legacyName of LEGACY_CONFIG_FILENAMES) {
      candidates.push(path.join(resolveUserPath(legacyStateDirOverride), legacyName));
    }
  }

  // Add default directory candidates
  candidates.push(path.join(currentStateDir(homedir), CONFIG_FILENAME));
  for (const legacyName of LEGACY_CONFIG_FILENAMES) {
    candidates.push(path.join(currentStateDir(homedir), legacyName));
  }

  for (let i = 0; i < LEGACY_STATE_DIRNAMES.length; i++) {
    const legacyDir = legacyStateDir(homedir, i);
    candidates.push(path.join(legacyDir, CONFIG_FILENAME));
    for (const legacyName of LEGACY_CONFIG_FILENAMES) {
      candidates.push(path.join(legacyDir, legacyName));
    }
  }

  return candidates;
}

export const DEFAULT_GATEWAY_PORT = 18789;

/**
 * Gateway lock directory (ephemeral).
 * Default: os.tmpdir()/mrbeanbot-<uid> (uid suffix when available).
 */
export function resolveGatewayLockDir(tmpdir: () => string = os.tmpdir): string {
  const base = tmpdir();
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  const suffix = uid != null ? `mrbeanbot-${uid}` : "mrbeanbot";
  return path.join(base, suffix);
}

const OAUTH_FILENAME = "oauth.json";

/**
 * OAuth credentials storage directory.
 *
 * Precedence:
 * - `MRBEANBOT_OAUTH_DIR`, `MRBEANBOT_OAUTH_DIR`, or `MRBEANBOT_OAUTH_DIR` (explicit override)
 * - `$*_STATE_DIR/credentials` (canonical server/default)
 * - `~/.mrbeanbot/credentials` (default)
 */
export function resolveOAuthDir(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, os.homedir),
): string {
  const override =
    env.MRBEANBOT_OAUTH_DIR?.trim() ||
    env.MRBEANBOT_OAUTH_DIR?.trim() ||
    env.MRBEANBOT_OAUTH_DIR?.trim();
  if (override) return resolveUserPath(override);
  return path.join(stateDir, "credentials");
}

export function resolveOAuthPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, os.homedir),
): string {
  return path.join(resolveOAuthDir(env, stateDir), OAUTH_FILENAME);
}

export function resolveGatewayPort(
  cfg?: MrBeanBotConfig,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const envRaw =
    env.MRBEANBOT_GATEWAY_PORT?.trim() ||
    env.MRBEANBOT_GATEWAY_PORT?.trim() ||
    env.MRBEANBOT_GATEWAY_PORT?.trim();
  if (envRaw) {
    const parsed = Number.parseInt(envRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const configPort = cfg?.gateway?.port;
  if (typeof configPort === "number" && Number.isFinite(configPort)) {
    if (configPort > 0) return configPort;
  }
  return DEFAULT_GATEWAY_PORT;
}
