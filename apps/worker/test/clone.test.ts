import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  calls: [] as { cmd: string; args: string[]; cwd: string }[],
  failAt: -1,
}));

vi.mock("node:child_process", () => ({
  execFile: (
    cmd: string,
    args: string[],
    opts: { cwd: string },
    cb: (err?: Error | null, stdout?: string, stderr?: string) => void,
  ) => {
    state.calls.push({ cmd, args, cwd: opts?.cwd });
    const idx = state.calls.length - 1;
    if (state.failAt >= 0 && idx === state.failAt) {
      cb(new Error(`command failed: ${cmd} ${args.join(" ")}`));
    } else {
      cb(null, "", "");
    }
  },
}));

import { cloneRepo } from "../src/clone";

async function leftoverCloneDirs(): Promise<string[]> {
  const tmp = os.tmpdir();
  const entries = await fs.readdir(tmp);
  return entries.filter((e) => e.startsWith("rio-clone-"));
}

describe("cloneRepo", () => {
  beforeEach(() => {
    state.calls = [];
    state.failAt = -1;
  });

  it("runs the git command sequence in order and returns a cleanup that removes the dir", async () => {
    const { path: dir, cleanup } = await cloneRepo("org-a", "repo-b", "abc123", "tok");

    expect(state.calls.map((c) => [c.cmd, ...c.args].join(" "))).toEqual([
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