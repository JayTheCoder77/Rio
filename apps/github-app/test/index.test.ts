import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const insertValues: unknown[] = [];
  const updateSets: unknown[] = [];
  const queueAdds: { queue: string; name: string; data: unknown; opts: unknown }[] = [];
  const handlers: { events: string[]; handler: (ctx: any) => Promise<unknown> }[] = [];
  const api = {
    reposGet: vi.fn(),
    getBranch: vi.fn(),
  };
  return {
    selectResults,
    insertValues,
    updateSets,
    queueAdds,
    handlers,
    api,
    app: {
      on: (events: string | string[], handler: (ctx: any) => Promise<unknown>) => {
        handlers.push({ events: Array.isArray(events) ? events : [events], handler });
      },
    },
  };
});

vi.mock("probot", () => ({ Probot: class {} }));

vi.mock("bullmq", () => ({
  Queue: class {
    constructor(public name: string) {}
    add(name: string, data: unknown, opts: unknown) {
      mocks.queueAdds.push({ queue: this.name, name, data, opts });
      return Promise.resolve({ id: "1" });
    }
  },
}));

vi.mock("ioredis", () => ({ default: class {} }));

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
      values: (values: unknown) => {
        mocks.insertValues.push(values);
        return {
          onConflictDoUpdate: () => ({
            returning: () => Promise.resolve([{ id: "row-1" }]),
          }),
        };
      },
    }),
    update: () => ({
      set: (set: unknown) => {
        mocks.updateSets.push(set);
        return { where: () => Promise.resolve() };
      },
    }),
  };
  return { db, installations: {}, repos: {} };
});

import appSetup from "../src/index";

async function fire(event: string, payload: unknown) {
  const ctx = {
    payload,
    octokit: {
      rest: {
        repos: {
          get: mocks.api.reposGet,
          getBranch: mocks.api.getBranch,
        },
      },
    },
  };
  const reg = mocks.handlers.find((h) => h.events.includes(event));
  if (!reg) throw new Error(`No handler for event ${event}`);
  await reg.handler(ctx);
}

beforeEach(() => {
  mocks.selectResults = [];
  mocks.insertValues = [];
  mocks.updateSets = [];
  mocks.queueAdds = [];
  vi.clearAllMocks();
  appSetup(mocks.app as any);
});

describe("github-app webhook handlers", () => {
  it("installation.created upserts installation, repos, and enqueues index jobs", async () => {
    mocks.api.reposGet.mockResolvedValue({ data: { default_branch: "main" } });
    mocks.api.getBranch.mockResolvedValue({ data: { commit: { sha: "abc123" } } });

    await fire("installation.created", {
      installation: { id: 1000, account: { login: "org-a" } },
      repositories: [{ id: 1, full_name: "org-a/repo-one" }],
    });

    expect(mocks.insertValues).toEqual([
      { githubInstallationId: 1000, accountLogin: "org-a" },
      { installationId: "row-1", githubRepoId: 1, fullName: "org-a/repo-one" },
    ]);
    expect(mocks.queueAdds).toHaveLength(1);
    expect(mocks.queueAdds[0]).toMatchObject({
      queue: "index-repo",
      name: "index",
      data: { repoId: "row-1", repo: "org-a/repo-one", sha: "abc123", installationId: 1000 },
      opts: { jobId: "index-org-a/repo-one-abc123" },
    });
  });

  it("installation_repositories.added handles repositories_added", async () => {
    mocks.api.reposGet.mockResolvedValue({ data: { default_branch: "main" } });
    mocks.api.getBranch.mockResolvedValue({ data: { commit: { sha: "def" } } });

    await fire("installation_repositories.added", {
      installation: { id: 1000, account: { login: "org-a" } },
      repositories_added: [{ id: 2, full_name: "org-a/repo-two" }],
    });

    expect(mocks.queueAdds[0].data).toMatchObject({ repo: "org-a/repo-two" });
  });

  it("installation_repositories.removed soft-deletes the repos", async () => {
    await fire("installation_repositories.removed", {
      repositories_removed: [{ id: 2 }, { id: 3 }],
    });

    expect(mocks.updateSets).toHaveLength(2);
    for (const s of mocks.updateSets) {
      expect(s).toEqual({ deletedAt: expect.any(Date) });
    }
  });

  it("installation.deleted soft-deletes the installation and its repos", async () => {
    mocks.selectResults.push([{ id: "inst-1" }]);

    await fire("installation.deleted", { installation: { id: 1000 } });

    expect(mocks.updateSets).toHaveLength(2);
  });

  it("pull_request.opened enqueues a pr-review job", async () => {
    await fire("pull_request.opened", {
      repository: { id: 1, full_name: "org-a/repo-one" },
      pull_request: { number: 5, base: { sha: "base" }, head: { sha: "head" } },
      installation: { id: 1000 },
    });

    expect(mocks.queueAdds).toHaveLength(1);
    expect(mocks.queueAdds[0]).toMatchObject({
      queue: "pr-review",
      name: "review",
      data: {
        repo: "org-a/repo-one",
        prNumber: 5,
        baseSha: "base",
        headSha: "head",
        installationId: 1000,
        githubRepoId: 1,
      },
      opts: { jobId: "org-a/repo-one-5-head" },
    });
  });

  it("push on the default branch enqueues an index job", async () => {
    mocks.selectResults.push([{ id: "repo-1" }]);

    await fire("push", {
      repository: { id: 1, full_name: "org-a/repo-one", default_branch: "main" },
      ref: "refs/heads/main",
      after: "newsha",
      installation: { id: 1000 },
    });

    expect(mocks.queueAdds).toHaveLength(1);
    expect(mocks.queueAdds[0]).toMatchObject({
      queue: "index-repo",
      data: { repoId: "repo-1", sha: "newsha", installationId: 1000 },
    });
  });

  it("push on a non-default branch is ignored", async () => {
    await fire("push", {
      repository: { id: 1, full_name: "org-a/repo-one", default_branch: "main" },
      ref: "refs/heads/feature",
      after: "newsha",
    });

    expect(mocks.queueAdds).toHaveLength(0);
    expect(mocks.selectResults).toHaveLength(0);
  });
});