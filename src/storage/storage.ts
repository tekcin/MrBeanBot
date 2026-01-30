import path from "path";
import fs from "fs/promises";

import { Lock } from "../utils/lock.js";
import { glob } from "fs/promises";

export namespace Storage {
  /** Base directory for storage, set during init */
  let baseDir = "";

  export class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NotFoundError";
    }
  }

  /**
   * Initialize storage with the given base directory.
   * Must be called before any other storage operation.
   */
  export async function init(storageBaseDir: string) {
    baseDir = path.join(storageBaseDir, "storage");
    await fs.mkdir(baseDir, { recursive: true });
    await runMigrations();
  }

  async function runMigrations() {
    const migrationFile = path.join(baseDir, "migration");
    let current = 0;
    try {
      const content = await fs.readFile(migrationFile, "utf-8");
      current = parseInt(content, 10) || 0;
    } catch {
      // No migration file yet
    }
    // No migrations needed for fresh installs
    await fs.writeFile(migrationFile, String(current));
  }

  function getDir(): string {
    if (!baseDir) {
      throw new Error("Storage not initialized. Call Storage.init() first.");
    }
    return baseDir;
  }

  export async function remove(key: string[]) {
    const dir = getDir();
    const target = path.join(dir, ...key) + ".json";
    return withErrorHandling(async () => {
      await fs.unlink(target).catch(() => {});
    });
  }

  export async function read<T>(key: string[]): Promise<T> {
    const dir = getDir();
    const target = path.join(dir, ...key) + ".json";
    return withErrorHandling(async () => {
      using _ = await Lock.read(target);
      const content = await fs.readFile(target, "utf-8");
      return JSON.parse(content) as T;
    });
  }

  export async function update<T>(key: string[], fn: (draft: T) => void): Promise<T> {
    const dir = getDir();
    const target = path.join(dir, ...key) + ".json";
    return withErrorHandling(async () => {
      using _ = await Lock.write(target);
      const raw = await fs.readFile(target, "utf-8");
      const content = JSON.parse(raw);
      fn(content);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, JSON.stringify(content, null, 2));
      return content as T;
    });
  }

  export async function write<T>(key: string[], content: T) {
    const dir = getDir();
    const target = path.join(dir, ...key) + ".json";
    return withErrorHandling(async () => {
      using _ = await Lock.write(target);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, JSON.stringify(content, null, 2));
    });
  }

  async function withErrorHandling<T>(body: () => Promise<T>): Promise<T> {
    return body().catch((e) => {
      if (!(e instanceof Error)) throw e;
      const errnoException = e as NodeJS.ErrnoException;
      if (errnoException.code === "ENOENT") {
        throw new NotFoundError(`Resource not found: ${errnoException.path ?? "unknown"}`);
      }
      throw e;
    });
  }

  export async function list(prefix: string[]): Promise<string[][]> {
    const dir = getDir();
    const scanDir = path.join(dir, ...prefix);
    try {
      const results: string[][] = [];
      for await (const entry of glob("**/*.json", { cwd: scanDir })) {
        results.push([...prefix, ...entry.slice(0, -5).split(path.sep)]);
      }
      results.sort((a, b) => a.join("/").localeCompare(b.join("/")));
      return results;
    } catch {
      return [];
    }
  }
}
