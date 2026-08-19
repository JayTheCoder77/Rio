import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  commands: [] as string[],
  failAt: -1,
  $: null as unknown,
}));

vi.mock("bun", () => {
  const exec = (cmd: string) => {
    state.commands.push(cmd);
    const idx = state.commands.length - 1;
    if (state.failAt >= 0 && idx === state.failAt) {
      return Promise.reject(new Error(`command failed: ${cmd}`));
    }
    return Promise.resolve();
  };
  state.$ = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const cmd = strings
      .map((s, i) => s + (values[i] ?? ""))
      .join("")
      .trim();
    const run = () => exec(cmd);
    const thenable = { then: (res: () => void, rej: (e: Error) => void) => run().then(res, rej) };
    return {
      cwd: () => ({ quiet: () => thenable }),
      quiet: () => thenable,
    };
  };
  return { $: state.$ };
});

import { cloneRepo } from "../src/clone";

async function leftoverCloneDirs(): Promise<string[]> {
  const tmp = os.tmpdir();
  const entries = await fs.readdir(tmp);
  return entries.filter((e) => e.startsWith("rio-clone-"));
}

describe("cloneRepo", () => {
  beforeEach(() => {
    state.commands = [];
    state.failAt = -1;
  });

  it("runs the git command sequence in order and returns a cleanup that removes the dir", async () => {
    const { path: dir, cleanup } = await cloneRepo("org-a", "repo-b", "abc123", "tok");

    expect(state.commands).toEqual([
      "git init",
      "git remote add origin https://x-access-token:tok@github.com/org-a/repo-b.git",
      "git fetch --depth=1 origin abc123",
      "git checkout abc123",
    ]);

    expect((await fs.stat(dir)).isDirectory()).toBe(true);
    await cleanup();
    await expect(fs.stat(dir)).rejects.toThrow();
  });

  it("removes the temp dir and throws when a git command fails", async () => {
    state.failAt = 2; // git fetch

    const before = await leftoverCloneDirs();

    await expect(
      cloneRepo("org-a", "repo-b", "abc123", "tok"),
    ).rejects.toThrow("command failed: git fetch --depth=1 origin abc123");

    // No NEW rio-clone dirs may remain after the failed attempt.
    const after = await leftoverCloneDirs();
    expect(after).toEqual(before);
  });
});