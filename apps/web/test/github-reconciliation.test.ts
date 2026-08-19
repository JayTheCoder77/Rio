import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  // Queue of results returned by db.select()...limit(1) in call order.
  selectResults: [] as unknown[],
  insertCalls: [] as { table: unknown; values: unknown }[],
}));

vi.mock("@rio/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            const next = mocks.selectResults.shift();
            return Promise.resolve(next ?? []);
          },
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        mocks.insertCalls.push({ table, values });
        return { onConflictDoNothing: () => Promise.resolve() };
      },
    }),
  },
  accounts: { provider: "github", userId: "user_id" },
  installations: { id: "id", githubInstallationId: "github_installation_id" },
  userInstallations: { userId: "user_id", installationId: "installation_id" },
}));

import { reconcileUserInstallations } from "@/lib/github-reconciliation";

describe("reconcileUserInstallations", () => {
  beforeEach(() => {
    mocks.selectResults = [];
    mocks.insertCalls = [];
    vi.unstubAllGlobals();
  });

  it("does nothing when the user has no linked github account", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    // First select (account lookup) returns no row.
    mocks.selectResults.push([]);

    await reconcileUserInstallations("u-1");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("backfills user_installations for known installations", async () => {
    // account row: valid, unexpired token
    mocks.selectResults.push([
      { accessToken: "tok", refreshToken: null, expiresAt: Math.floor(Date.now() / 1000) + 3600 },
    ]);
    // github API returns two installations; only one is known to us.
    mocks.selectResults.push([{ id: "inst-1" }]); // first gh id 100 exists
    mocks.selectResults.push([]); // second gh id 200 unknown

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        installations: [
          { id: 100, account: { login: "org-a" } },
          { id: 200, account: { login: "org-b" } },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await reconcileUserInstallations("u-1");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/user/installations",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tok" }) }),
    );
    // Only the known installation gets a link row.
    expect(mocks.insertCalls).toHaveLength(1);
    expect(mocks.insertCalls[0]!.values).toEqual({ userId: "u-1", installationId: "inst-1" });
  });

  it("skips the github call when the refresh fails", async () => {
    // account row: expired token + refresh token
    mocks.selectResults.push([
      { accessToken: "old", refreshToken: "rt", expiresAt: Math.floor(Date.now() / 1000) - 100 },
    ]);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchSpy);

    await reconcileUserInstallations("u-1");
    // Only the token refresh call is attempted; no installations call.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mocks.insertCalls).toHaveLength(0);
  });
});