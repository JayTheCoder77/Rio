import { Probot } from "probot";
import { db, installations } from "@rio/db";
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
  app.on("installation.created", async (context) => {
    const id = context.payload.installation.id;
    const account = context.payload.installation.account;
    if (!account || !("login" in account)) return;
    const login = account.login;

    await db.insert(installations)
      .values({ githubInstallationId: id, accountLogin: login })
      .onConflictDoUpdate({
        target: installations.githubInstallationId,
        set: { accountLogin: login, deletedAt: null },
      });
  });

  app.on("installation.deleted", async (context) => {
    const id = context.payload.installation.id;

    await db.update(installations)
      .set({ deletedAt: new Date() })
      .where(eq(installations.githubInstallationId, id));
  });

  app.on(["pull_request.opened" , "pull_request.synchronize"] , async (context) => {
    const payload = context.payload;
    const repo = payload.repository.full_name;
    const prNumber = payload.pull_request.number;
    const baseSha = payload.pull_request.base.sha;
    const headSha = payload.pull_request.head.sha;
    const installationId = context.payload.installation?.id;

    if(!installationId) throw new Error("Installation id is not defined");

    await prReviewQueue.add("review", {
      repo,
      prNumber,
      baseSha,
      headSha,
      installationId,
    },
      { jobId: `${repo}-${prNumber}-${headSha}` },
    );

  })
}


