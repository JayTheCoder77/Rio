import { eq, and, isNull, count, desc } from "drizzle-orm";
import { db } from "./db";
import { userInstallations, installations, repos, apiKeys, reviews, findings } from "./schema";
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