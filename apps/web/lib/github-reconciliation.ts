import { eq, and } from "drizzle-orm";
import { db, accounts, installations, userInstallations } from "@rio/db";

interface GithubInstallation {
  id: number;
  account: { login: string } | null;
}

/**
 * Refreshes the stored GitHub OAuth token for a user if it is expired
 * (or close to expiring), persisting the new access/refresh token pair.
 * Returns a usable access token, or null if there is no linked GitHub
 * account or the refresh itself fails (e.g. refresh token also expired).
 */
async function getValidGithubAccessToken(userId: string): Promise<string | null> {
  const [account] = await db
    .select({
      accessToken: accounts.access_token,
      refreshToken: accounts.refresh_token,
      expiresAt: accounts.expires_at,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")))
    .limit(1);

  if (!account?.accessToken) return null;

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const isExpired = !account.expiresAt || account.expiresAt <= nowInSeconds + 60;

  if (!isExpired) return account.accessToken;
  if (!account.refreshToken) return null;

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GITHUB_ID!,
      client_secret: process.env.AUTH_GITHUB_SECRET!,
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
    }),
  });

  if (!res.ok) return null;

  const body = await res.json();
  if (!body.access_token) return null;

  await db
    .update(accounts)
    .set({
      access_token: body.access_token,
      refresh_token: body.refresh_token ?? account.refreshToken,
      expires_at: body.expires_in ? nowInSeconds + body.expires_in : null,
    })
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")));

  return body.access_token as string;
}

/**
 * Reconciles GitHub App installations the user can access (per GitHub's
 * own authorization, via GET /user/installations) against installations
 * already known to us, backfilling any missing `user_installations` links.
 *
 * This covers the case where a user installs the GitHub App directly from
 * GitHub's UI (marketplace/org settings) rather than through our own
 * `startInstall` -> install-callback flow, which is the only other path
 * that currently creates `user_installations` rows.
 */
export async function reconcileUserInstallations(userId: string): Promise<void> {
  const accessToken = await getValidGithubAccessToken(userId);
  if (!accessToken) return;

  const res = await fetch("https://api.github.com/user/installations", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) return;

  const body = await res.json();
  const githubInstallations: GithubInstallation[] = body?.installations ?? [];
  if (githubInstallations.length === 0) return;

  for (const gh of githubInstallations) {
    const [inst] = await db
      .select({ id: installations.id })
      .from(installations)
      .where(eq(installations.githubInstallationId, gh.id))
      .limit(1);

    if (!inst) continue; // not yet known to us (e.g. webhook hasn't landed)

    await db
      .insert(userInstallations)
      .values({ userId, installationId: inst.id })
      .onConflictDoNothing();
  }
}
