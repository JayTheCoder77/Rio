import { vi } from "vitest";

// Shared plumbing for the worker processor tests. Lives in a separate file
// so worker.test.ts stays focused on assertions. The `capturedHandler` lives
// here because the "bullmq" mock factory (which is hoisted) must reference a
// stable module-scope object.
const mocks = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const insertReturning: unknown[][] = [];
  const api = {
    get: vi.fn(),
    listFiles: vi.fn(),
    getContent: vi.fn(),
    createReview: vi.fn(),
    createComment: vi.fn(),
    createCheck: vi.fn(),
    paginate: vi.fn(),
  };
  return {
    selectResults,
    insertReturning,
    api,
    capturedHandler: null as ((job: unknown) => Promise<unknown>) | null,
    octokitInstance: null as unknown,
    cloneRepo: vi.fn(),
    getInstallationOwnerId: vi.fn(),
  };
});

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(
      _queue: string,
      handler: (job: unknown) => Promise<unknown>,
      _opts: unknown,
    ) {
      mocks.capturedHandler = handler;
    }
  },
  Job: class {},
}));

vi.mock("ioredis", () => ({ default: class {} }));

vi.mock("@octokit/auth-app", () => ({
  createAppAuth: () => async () => ({ token: "inst-token" }),
}));

vi.mock("octokit", () => {
  class MockOctokit {
    rest: Record<string, unknown>;
    paginate: typeof mocks.api.paginate;
    constructor(_opts: unknown) {
      mocks.octokitInstance = this;
      this.rest = {
        pulls: {
          get: mocks.api.get,
          listFiles: mocks.api.listFiles,
          createReview: mocks.api.createReview,
        },
        issues: { createComment: mocks.api.createComment },
        checks: { create: mocks.api.createCheck },
        repos: { getContent: mocks.api.getContent },
      };
      this.paginate = async (fn: () => Promise<unknown>, _params: unknown) => {
        const out = await fn();
        return Array.isArray(out) ? out : (out as { data: unknown[] }).data;
      };
    }
  }
  return { Octokit: MockOctokit };
});

vi.mock("@rio/db", () => {
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mocks.selectResults.shift() ?? []),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: () => Promise.resolve(mocks.insertReturning.shift() ?? []),
        }),
        onConflictDoNothing: () => ({
          returning: () => Promise.resolve(mocks.insertReturning.shift() ?? []),
        }),
      }),
    }),
    transaction: (cb: (tx: typeof db) => Promise<unknown>) => cb(db),
  };
  return {
    db,
    repos: {},
    reviews: {},
    findings: {},
    installations: {},
    getInstallationOwnerId: mocks.getInstallationOwnerId,
  };
});

vi.mock("/Users/jayant/projects/Rio/apps/worker/src/clone", () => ({
  cloneRepo: mocks.cloneRepo,
}));

export const testMocks = mocks;

export const JOB = {
  data: {
    repo: "org-a/repo-b",
    prNumber: 7,
    headSha: "sha-abc",
    baseSha: "sha-base",
    installationId: 123456,
    githubRepoId: 987654,
  },
  log: () => {},
} as any;

export const DIFF = "diff --git a/a.py b/a.py\n@@ -1 +1 @@\n-old\n+new\n";

export async function runHandler() {
  const handler = mocks.capturedHandler!;
  return handler(JOB);
}

// Ensures worker.ts is loaded into the module graph so its module-scope
// `new Worker(...)` executes and captures the processor.
import "../src/worker";