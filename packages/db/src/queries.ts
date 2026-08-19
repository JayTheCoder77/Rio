import { eq, and, isNull, count, desc } from "drizzle-orm";
import { db } from "./db";
import { userInstallations, installations, repos, apiKeys, reviews, findings, users } from "./schema";
import type { DashboardRepo } from "@rio/shared-types";

export interface ReviewStats {
  totalReviews: number;
  unresolvedFindings: {
    critical: number; warning: number; info:
    number
  };
}

export interface RecentReview {
  id: string;
  repoFullName: string;
  prNumber: number;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: Date;
  findingsCount: number;
}

/**
 * All active repos the given user has access to, via their linked
 * GitHub App installations. Excludes soft-deleted installations/repos.
 */
export async function getUserRepos(userId: string): Promise<DashboardRepo[]> {
  const rows = await db
    .select({
      id: repos.id,
      fullName: repos.fullName,
      installationAccountLogin: installations.accountLogin,
    })
    .from(userInstallations)
    .innerJoin(installations, eq(userInstallations.installationId, installations.id))
    .innerJoin(repos, eq(repos.installationId, installations.id))
    .where(
      and(
        eq(userInstallations.userId, userId),
        isNull(installations.deletedAt),
        isNull(repos.deletedAt)
      )
    );

  return rows;
}

/**
 * Cheap existence check used to early-exit reconciliation: if the user
 * already has at least one linked installation, skip the GitHub API call.
 */
export async function userHasInstallations(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userInstallations.id })
    .from(userInstallations)
    .where(eq(userInstallations.userId, userId))
    .limit(1);

  return !!row;
}

/**
 * Resolves which Rio user's BYOK provider credential should power reviews
 * for a given GitHub installation. `userInstallations` is many-to-many (a
 * team's installation can have several linked Rio accounts, e.g. multiple
 * teammates who each signed in via GitHub OAuth) — there's no single "owner"
 * column. As a pragmatic default, this picks the *earliest-linked* user for
 * that installation, i.e. whoever connected it first.
 *
 * Known tradeoff (accepted for now, not building around it yet): if that
 * first-linked user's credential is missing/revoked, reviews for the whole
 * installation fail closed — even if another linked teammate has their own
 * valid key configured. Revisit if/when installation-level (rather than
 * per-user) credentials are worth the schema change.
 */
export async function getInstallationOwnerId(installationDbId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: userInstallations.userId })
    .from(userInstallations)
    .where(eq(userInstallations.installationId, installationDbId))
    .orderBy(userInstallations.createdAt)
    .limit(1);

  return row?.userId ?? null;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  lastFour: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/** All active (non-revoked) API keys for a user, newest first. */
export async function getUserApiKeys(userId: string): Promise<ApiKeySummary[]> {
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      lastFour: apiKeys.lastFour,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .orderBy(apiKeys.createdAt);

  return rows.reverse();
}

/** Inserts a new API key row. Caller is responsible for hashing the key. */
export async function createApiKey(params: {
  userId: string;
  name: string;
  keyHash: string;
  lastFour: string;
}): Promise<ApiKeySummary> {
  const [row] = await db
    .insert(apiKeys)
    .values({
      userId: params.userId,
      name: params.name,
      keyHash: params.keyHash,
      lastFour: params.lastFour,
    })
    .returning({
      id: apiKeys.id,
      name: apiKeys.name,
      lastFour: apiKeys.lastFour,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    });

  if (!row) throw new Error("Failed to create API key");
  return row;
}

/** Soft-revokes an API key. Scoped to userId so users can't revoke others' keys. */
export async function revokeApiKey(params: { userId: string; keyId: string }): Promise<void> {
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, params.keyId), eq(apiKeys.userId, params.userId)));
}

export interface ModelCredentialSummary {
  provider: "groq" | "openrouter";
  modelName: string;
  lastFour: string;
}

/**
 * The caller's BYOK provider credential, for display only — write-only past
 * this point, same discipline as `ApiKeySummary`. The encrypted key itself
 * is never returned; callers needing the last-4-chars display value must
 * pass it in explicitly at write time (see `setUserModelCredential`), since
 * it can't be recovered from the encrypted column afterward.
 */
export async function getUserModelCredentialSummary(userId: string): Promise<ModelCredentialSummary | null> {
  const [row] = await db
    .select({
      modelProvider: users.modelProvider,
      modelName: users.modelName,
      modelApiKeyLastFour: users.modelApiKeyLastFour,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || !row.modelProvider || !row.modelName || !row.modelApiKeyLastFour) return null;

  return {
    provider: row.modelProvider,
    modelName: row.modelName,
    lastFour: row.modelApiKeyLastFour,
  };
}

/** Saves (or overwrites) the caller's BYOK provider credential. Caller is
 * responsible for encrypting `apiKeyEncrypted` before calling this — see
 * `apps/web/lib/model-credentials.ts`. */
export async function setUserModelCredential(params: {
  userId: string;
  provider: "groq" | "openrouter";
  modelName: string;
  apiKeyEncrypted: string;
  lastFour: string;
}): Promise<void> {
  await db
    .update(users)
    .set({
      modelProvider: params.provider,
      modelName: params.modelName,
      modelApiKeyEncrypted: params.apiKeyEncrypted,
      modelApiKeyLastFour: params.lastFour,
    })
    .where(eq(users.id, params.userId));
}

/** Disconnects the caller's BYOK provider credential. */
export async function clearUserModelCredential(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      modelProvider: null,
      modelName: null,
      modelApiKeyEncrypted: null,
      modelApiKeyLastFour: null,
    })
    .where(eq(users.id, userId));
}

export async function getReviewStats(userId: string) {

  const severityRows = await db.select({ severity: findings.severity, count: count() })
    .from(findings)
    .innerJoin(reviews, eq(findings.reviewId, reviews.id))
    .innerJoin(repos, eq(reviews.repoId, repos.id))
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .innerJoin(userInstallations, eq(installations.id, userInstallations.installationId))
    .where(
      and(
        eq(userInstallations.userId, userId),
        eq(findings.resolved, false),
        isNull(installations.deletedAt),
        isNull(repos.deletedAt),
      )
    )
    .groupBy(findings.severity)

  const [review] = await db.select({ count: count() })
    .from(reviews)
    .innerJoin(repos, eq(reviews.repoId, repos.id))
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .innerJoin(userInstallations, eq(installations.id, userInstallations.installationId))
    .where(
      and(
        eq(userInstallations.userId, userId),
        isNull(installations.deletedAt),
        isNull(repos.deletedAt)
      )
    )

  const unresolvedFindings = { critical: 0, warning: 0, info: 0 };
  for (const row of severityRows) {
    unresolvedFindings[row.severity] = row.count;
  }
  return {
    totalReviews: review?.count ?? 0,
    unresolvedFindings
  };
}

export async function getRecentReviews(userId: string,
  limit: number): Promise<RecentReview[]> {

  const findingsCountSubquery = db
    .select({
      reviewId: findings.reviewId,
      findingsCount: count().as("findings_count"),
    })
    .from(findings)
    .groupBy(findings.reviewId)
    .as("findings_count_sq");

  const rows = await db.select({
    id: reviews.id,
    repoFullName: repos.fullName,
    prNumber: reviews.prNumber,
    status: reviews.status,
    createdAt: reviews.createdAt,
    findingsCount: findingsCountSubquery.findingsCount,
  })
    .from(reviews)
    .innerJoin(repos, eq(reviews.repoId, repos.id))
    .innerJoin(installations, eq(repos.installationId, installations.id))
    .innerJoin(userInstallations, eq(installations.id, userInstallations.installationId))
    .leftJoin(findingsCountSubquery, eq(reviews.id, findingsCountSubquery.reviewId))
    .where(
      and(
        eq(userInstallations.userId, userId),
        isNull(installations.deletedAt),
        isNull(repos.deletedAt)
      )
    )
    .orderBy(desc(reviews.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    ...row,
    findingsCount : row.findingsCount ?? 0,
  }));
  }