import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIFF, JOB, runHandler, testMocks } from "./worker-test-helper";

describe("worker processor", () => {
  beforeEach(() => {
    testMocks.selectResults = [];
    testMocks.insertReturning = [];
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("no-ops when a completed review already exists for the head sha", async () => {
    testMocks.selectResults.push([{ id: "existing" }]); // dedupe check

    await runHandler();

    expect(testMocks.api.get).not.toHaveBeenCalled();
    expect(testMocks.api.createComment).not.toHaveBeenCalled();
  });

  it("runs the happy path: diff, sandbox lint, review, comments, check, db writes", async () => {
    testMocks.selectResults.push([]); // dedupe check
    testMocks.selectResults.push([]); // existing repo row (new repo)
    testMocks.selectResults.push([{ id: "inst-1" }]); // installation
    testMocks.insertReturning.push([{ id: "repo-1" }]); // upsert repo
    testMocks.insertReturning.push([{ id: "rev-1" }]); // insert review
    testMocks.getInstallationOwnerId.mockResolvedValue("user-1");
    testMocks.cloneRepo.mockResolvedValue({ path: "/tmp/clone", cleanup: vi.fn() });

    testMocks.api.get.mockResolvedValue({ data: DIFF });
    testMocks.api.getContent.mockResolvedValue({
      data: { content: Buffer.from("require_check: true\n").toString("base64") },
    });
    testMocks.api.listFiles.mockResolvedValue([{ filename: "a.py" }, { filename: "b.ts" }]);
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ lint_results: [{ ok: true }] }) })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            findings: [
              { file: "a.py", line: 3, severity: "critical", message: "m", rationale: "r" },
            ],
          }),
        }),
    );

    const result = await runHandler();
    expect(result).toBeUndefined();

    // .rio.yml parsed -> require_check true -> critical finding -> failure check
    expect(testMocks.api.createCheck).toHaveBeenCalledWith(
      expect.objectContaining({ conclusion: "failure" }),
    );
    // inline comment posted
    expect(testMocks.api.createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        commit_id: "sha-abc",
        comments: [expect.objectContaining({ path: "a.py", line: 3 })],
      }),
    );
    // ai-engine called as internal caller on behalf of the linked user
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/review"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Internal-Service-Token": "test-internal-token",
        }),
      }),
    );
    // sandbox cloned and linted
    expect(testMocks.cloneRepo).toHaveBeenCalledWith("org-a", "repo-b", "sha-abc", "inst-token");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/verify"),
      expect.anything(),
    );
  });

  it("posts a specific failure comment and rethrows on a 412 response", async () => {
    testMocks.selectResults.push([]); // dedupe
    testMocks.selectResults.push([]); // existing repo row
    testMocks.selectResults.push([{ id: "inst-1" }]);
    testMocks.getInstallationOwnerId.mockResolvedValue("user-1");
    testMocks.cloneRepo.mockResolvedValue({ path: "/tmp/clone", cleanup: vi.fn() });
    testMocks.api.get.mockResolvedValue({ data: DIFF });
    testMocks.api.getContent.mockRejectedValue(new Error("no config")); // fetchRioConfig swallows

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ lint_results: [] }) })
        .mockResolvedValueOnce({
          ok: false,
          status: 412,
          json: async () => ({ detail: "Bad model name" }),
        }),
    );

    await expect(runHandler()).rejects.toThrow("Bad model name");

    expect(testMocks.api.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_number: 7,
        body: expect.stringContaining("Bad model name"),
      }),
    );
  });

  it("fails with a comment when no Rio user is linked to the installation", async () => {
    testMocks.selectResults.push([]); // dedupe
    testMocks.selectResults.push([]); // existing repo row
    testMocks.selectResults.push([{ id: "inst-1" }]);
    testMocks.getInstallationOwnerId.mockResolvedValue(null);
    testMocks.api.get.mockResolvedValue({ data: DIFF });

    await expect(runHandler()).rejects.toThrow(/No Rio user linked/);
    expect(testMocks.api.createComment).toHaveBeenCalledTimes(1);
  });

  it("proceeds with review when the sandbox clone fails", async () => {
    testMocks.selectResults.push([]); // dedupe
    testMocks.selectResults.push([]); // existing repo row
    testMocks.selectResults.push([{ id: "inst-1" }]);
    testMocks.insertReturning.push([{ id: "repo-1" }]);
    testMocks.insertReturning.push([{ id: "rev-1" }]);
    testMocks.getInstallationOwnerId.mockResolvedValue("user-1");
    testMocks.cloneRepo.mockRejectedValue(new Error("clone boom"));

    testMocks.api.get.mockResolvedValue({ data: DIFF });
    testMocks.api.getContent.mockRejectedValue(new Error("no config"));
    testMocks.api.listFiles.mockResolvedValue([]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ findings: [] }),
      }),
    );

    const result = await runHandler();
    expect(result).toBeUndefined();
    // Sandbox failure is non-fatal; no failure comment was posted.
    expect(testMocks.api.createComment).not.toHaveBeenCalled();
    expect(testMocks.cloneRepo).toHaveBeenCalledTimes(1);
  });

  it("skips cloning and linting when sandbox execution is disabled", async () => {
    process.env.SANDBOX_ENABLED = "false";
    testMocks.selectResults.push([]); // dedupe
    testMocks.selectResults.push([]); // existing repo row
    testMocks.selectResults.push([{ id: "inst-1" }]); // installation
    testMocks.insertReturning.push([{ id: "repo-1" }]); // upsert repo
    testMocks.insertReturning.push([{ id: "rev-1" }]); // insert review
    testMocks.getInstallationOwnerId.mockResolvedValue("user-1");
    testMocks.api.get.mockResolvedValue({ data: DIFF });
    testMocks.api.getContent.mockRejectedValue(new Error("no config"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ findings: [] }),
      }),
    );

    await runHandler();

    expect(testMocks.cloneRepo).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/v1/review"), expect.anything());
    delete process.env.SANDBOX_ENABLED;
  });
});
