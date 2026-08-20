import { vi } from "vitest";

// Mirrors worker-test-helper.ts: hoisted mocks captured here so the "bullmq"
// factory (which is hoisted above all imports) can reference a stable object.
const mocks = vi.hoisted(() => {
  return {
    capturedHandler: null as ((job: unknown) => Promise<unknown>) | null,
    cloneRepo: vi.fn(),
    cleanup: vi.fn(),
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
    on() {}
  },
  Job: class {},
}));

vi.mock("ioredis", () => ({ default: class {} }));

vi.mock("@octokit/auth-app", () => ({
  createAppAuth: () => async () => ({ token: "inst-token" }),
}));

vi.mock(new URL("../src/clone", import.meta.url).pathname, () => ({
  cloneRepo: mocks.cloneRepo,
}));

export const testMocks = mocks;

export const JOB = {
  data: {
    repoId: "repo-42",
    repo: "org-a/repo-b",
    sha: "sha-abc",
    installationId: 123456,
  },
  log: () => {},
} as any;

export async function runJob(job: unknown) {
  const handler = mocks.capturedHandler!;
  return handler(job);
}

export async function runHandler() {
  return runJob(JOB);
}

// Loads indexWorker.ts so its module-scope `new Worker(...)` captures the
// processor.
import "../src/indexWorker";