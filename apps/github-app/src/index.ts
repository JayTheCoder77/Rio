import { Probot } from "probot";
import { db, installations, repos } from "@rio/db";
import { eq } from "drizzle-orm";
import { Queue } from "bullmq";
import type { PrReviewJob } from "@rio/shared-types";
import IORedis from "ioredis";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in the .env file');
}

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const prReviewQueue = new Queue<PrReviewJob>("pr-review", { connection });

export default (app: Probot) => {
  app.on(["installation.created", "installation_repositories.added"], async (context) => {
    const id = context.payload.installation.id;
    const account = context.payload.installation.account;
    const payloadRepos = (context.payload as { repositories?: { id: number; full_name: string }[] }).repositories ?? [];

    if (!account || !("login" in account)) return;
    const login = account.login;

    const [inst] = await db.insert(installations)
      .values({ githubInstallationId: id, accountLogin: login })
      .onConflictDoUpdate({
        target: installations.githubInstallationId,
        set: { accountLogin: login, deletedAt: null },
      }).returning({ id: installations.id });

    if (!inst) throw new Error('inst error');

    for (const repo of payloadRepos) {
      await db.insert(repos)
        .values({
          installationId: inst.id,
          githubRepoId: repo.id,
          fullName: repo.full_name,
        })
        .onConflictDoUpdate({
          target: repos.githubRepoId,
          set: { installationId: inst.id, fullName: repo.full_name, deletedAt: null },
        });
    }
  });

  app.on("installation_repositories.removed", async (context) => {
    const payloadRepos = (context.payload as unknown as { repositories: { id: number }[] }).repositories;
    for (const repo of payloadRepos) {
      await db.update(repos)
        .set({ deletedAt: new Date() })
        .where(eq(repos.githubRepoId, repo.id));
    }
  });

  app.on("installation.deleted", async (context) => {
    const githubInstallId = context.payload.installation.id;

    const [inst] = await db.select({ id: installations.id })
      .from(installations)
      .where(eq(installations.githubInstallationId, githubInstallId))
      .limit(1);

    await db.update(installations)
      .set({ deletedAt: new Date() })
      .where(eq(installations.githubInstallationId, githubInstallId));

    if (inst) {
      await db.update(repos)
        .set({ deletedAt: new Date() })
        .where(eq(repos.installationId, inst.id));
    }
  });

  app.on(["pull_request.opened", "pull_request.synchronize"], async (context) => {
    const payload = context.payload;
    const repo = payload.repository.full_name;
    const prNumber = payload.pull_request.number;
    const baseSha = payload.pull_request.base.sha;
    const headSha = payload.pull_request.head.sha;
    const installationId = context.payload.installation?.id;

    if (!installationId) throw new Error("Installation id is not defined");

    await prReviewQueue.add("review", {
      repo,
      prNumber,
      baseSha,
      headSha,
      installationId,
      githubRepoId: payload.repository.id,
    },
      { jobId: `${repo}-${prNumber}-${headSha}` },
    );
  });
}


