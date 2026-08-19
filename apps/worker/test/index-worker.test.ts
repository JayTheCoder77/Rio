import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JOB, runHandler, runJob, testMocks } from "./index-worker-test-helper";

const AI_ENGINE_URL = "http://localhost:8000/v1/index/repo";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ status: "ok", chunks_indexed: 42 }),
  } as Response);
  testMocks.cloneRepo.mockResolvedValue({
    path: "/tmp/rio-clone/xyz",
    cleanup: testMocks.cleanup,
  });
  testMocks.cleanup.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("index-repo worker", () => {
  it("clones with an installation token and posts to ai-engine", async () => {
    await runHandler();

    expect(testMocks.cloneRepo).toHaveBeenCalledWith("org-a", "repo-b", "sha-abc", "inst-token");
    expect(fetch).toHaveBeenCalledWith(AI_ENGINE_URL, expect.objectContaining({ method: "POST" }));
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      repo_path: "/tmp/rio-clone/xyz",
      repo_id: "repo-42",
    });
    expect(testMocks.cleanup).toHaveBeenCalled();
  });

  it("throws on a malformed repo full_name", async () => {
    await expect(runJob({ ...JOB, data: { ...JOB.data, repo: "no-slash" } })).rejects.toThrow(
      "Malformed repo full_name",
    );
    expect(testMocks.cloneRepo).not.toHaveBeenCalled();
  });

  it("throws and still cleans up when ai-engine returns an error", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(runHandler()).rejects.toThrow("ai-engine returned 500");
    expect(testMocks.cleanup).toHaveBeenCalled();
  });

  it("propagates clone failures without calling ai-engine", async () => {
    testMocks.cloneRepo.mockRejectedValue(new Error("clone blew up"));

    await expect(runHandler()).rejects.toThrow("clone blew up");
    expect(fetch).not.toHaveBeenCalled();
    expect(testMocks.cleanup).not.toHaveBeenCalled();
  });
});