import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";

// These tests run against a real local Postgres (docker-compose) using a
// dedicated `rio_test` database, so the drizzle query logic is exercised
// against actual SQL. Skipped when Postgres is unreachable.
// The test's DATABASE_URL is set by test/setup-db.ts.

let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;

let connected = true;
try {
  const probe = postgres("postgresql://rio:rio@localhost:5432/postgres", {
    max: 1,
    connect_timeout: 3,
  });
  await probe`select 1`;
  await probe.end();
} catch {
  connected = false;
}

const RUNNING = connected;

const maybeDescribe = RUNNING ? describe : describe.skip;

import * as schema from "../src/schema";
import {
  clearUserModelCredential,
  createApiKey,
  getInstallationOwnerId,
  getRecentReviews,
  getReviewStats,
  getUserApiKeys,
  getUserModelCredentialSummary,
  getUserRepos,
  revokeApiKey,
  setUserModelCredential,
  userHasInstallations,
} from "../src/queries";

let userId: string;
let otherUserId: string;
let installationId: string;
let repoId: string;
let secondRepoId: string;

beforeAll(async () => {
  client = postgres("postgresql://rio:rio@localhost:5432/rio_test", { max: 5 });
  db = drizzle(client);
  await migrate(db, { migrationsFolder: "drizzle" });

  // Clean slate.
  await db.execute(`TRUNCATE findings, reviews, api_keys, repos,
      user_installations, installations, accounts, users RESTART IDENTITY CASCADE`);

  // Seed: two users, one installation with two repos, links for both users.
  const [u1] = await db.insert(schema.users).values({ email: "a@test.dev" }).returning({ id: schema.users.id });
  const [u2] = await db.insert(schema.users).values({ email: "b@test.dev" }).returning({ id: schema.users.id });
  userId = u1.id;
  otherUserId = u2.id;

  const [inst] = await db
    .insert(schema.installations)
    .values({ githubInstallationId: 123456789, accountLogin: "some-org" })
    .returning({ id: schema.installations.id });
  installationId = inst.id;

  const [r1] = await db
    .insert(schema.repos)
    .values({ installationId, githubRepoId: 987654321, fullName: "some-org/repo-one" })
    .returning({ id: schema.repos.id });
  const [r2] = await db
    .insert(schema.repos)
    .values({ installationId, githubRepoId: 987654322, fullName: "some-org/repo-two" })
    .returning({ id: schema.repos.id });
  repoId = r1.id;
  secondRepoId = r2.id;

  await db.insert(schema.userInstallations).values([
    { userId, installationId },
    { userId: otherUserId, installationId },
  ]);
});

maybeDescribe("db queries (integration)", () => {
  it("getUserRepos returns active repos for the user", async () => {
    const repos = await getUserRepos(userId);
    expect(repos.map((r) => r.fullName).sort()).toEqual(["some-org/repo-one", "some-org/repo-two"]);
    expect(repos[0].installationAccountLogin).toBe("some-org");
  });

  it("userHasInstallations true/false", async () => {
    expect(await userHasInstallations(userId)).toBe(true);
    expect(await userHasInstallations("00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  it("getInstallationOwnerId returns the earliest-linked user", async () => {
    const owner = await getInstallationOwnerId(installationId);
    expect(owner).toBe(userId);
    expect(await getInstallationOwnerId("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("createApiKey + getUserApiKeys + revokeApiKey", async () => {
    const created = await createApiKey({
      userId,
      name: "cli",
      keyHash: "abc123hash",
      lastFour: "wxyz",
    });
    expect(created.lastFour).toBe("wxyz");

    const keys = await getUserApiKeys(userId);
    expect(keys.map((k) => k.id)).toContain(created.id);

    await revokeApiKey({ userId, keyId: created.id });
    expect((await getUserApiKeys(userId)).map((k) => k.id)).not.toContain(created.id);
  });

  it("set/get/clear model credential", async () => {
    expect(await getUserModelCredentialSummary(userId)).toBeNull();

    await setUserModelCredential({
      userId,
      provider: "openrouter",
      modelName: "m",
      apiKeyEncrypted: "encrypted-blob",
      lastFour: "be8f",
    });
    const summary = await getUserModelCredentialSummary(userId);
    expect(summary?.provider).toBe("openrouter");
    expect(summary?.lastFour).toBe("be8f");

    await clearUserModelCredential(userId);
    expect(await getUserModelCredentialSummary(userId)).toBeNull();
  });

  it("getReviewStats + getRecentReviews aggregate findings", async () => {
    const [rev] = await db
      .insert(schema.reviews)
      .values({ repoId, prNumber: 1, headSha: "sha1", status: "completed" })
      .returning({ id: schema.reviews.id });
    await db.insert(schema.findings).values([
      { reviewId: rev.id, file: "a.py", line: 1, severity: "critical", message: "m", rationale: "r", resolved: false },
      { reviewId: rev.id, file: "a.py", line: 2, severity: "warning", message: "m", rationale: "r", resolved: false },
      { reviewId: rev.id, file: "a.py", line: 3, severity: "info", message: "m", rationale: "r", resolved: true },
    ]);

    const stats = await getReviewStats(userId);
    expect(stats.totalReviews).toBe(1);
    expect(stats.unresolvedFindings).toEqual({ critical: 1, warning: 1, info: 0 });

    const recent = await getRecentReviews(userId, 5);
    expect(recent).toHaveLength(1);
    expect(recent[0].repoFullName).toBe("some-org/repo-one");
    expect(recent[0].findingsCount).toBe(3);
  });

  it("soft-deleted repos are excluded", async () => {
    await db
      .update(schema.repos)
      .set({ deletedAt: new Date() })
      .where(eq(schema.repos.id, secondRepoId));

    const repos = await getUserRepos(userId);
    expect(repos.map((r) => r.id)).not.toContain(secondRepoId);
  });
});