// Manual integration test: enqueues one real job onto the "index-repo" queue
// using a real installation + repo already present in the DB, then exits.
// Run `bun run start:index` in a separate terminal first to actually process it.
//
// Usage: bun run tests/testIndex.ts

import { Queue } from "bullmq";
import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import IORedis from "ioredis";
import dotenv from "dotenv";
import path from "node:path";
import type { IndexRepoJob } from "@rio/shared-types";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") }); // root: REDIS_URL
dotenv.config({ path: path.resolve(__dirname, "../.env") });        // local: APP_ID, PRIVATE_KEY

// Real values pulled from the DB (installations/repos tables) — see chat history.
// githubInstallationId 150777941 is the live (non-deleted) installation for JayTheCoder77.
const REPO_ID = "e5d7197a-30b1-4615-8055-9031360ec11b"; // repos.id (DB UUID) -> Pinecone namespace
const REPO_FULL_NAME = "JayTheCoder77/computerVision";
const INSTALLATION_ID = 150777941;

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const indexRepoQueue = new Queue<IndexRepoJob>("index-repo", { connection });

const [owner, repoName] = REPO_FULL_NAME.split("/");
if (!owner || !repoName) throw new Error(`Malformed repo full_name: ${REPO_FULL_NAME}`);

const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
        appId: process.env.APP_ID,
        privateKey: process.env.PRIVATE_KEY!.replace(/\\n/g, "\n"),
        installationId: INSTALLATION_ID,
    },
});

const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo: repoName });
const { data: branch } = await octokit.rest.repos.getBranch({
    owner,
    repo: repoName,
    branch: repoInfo.default_branch,
});

const job = await indexRepoQueue.add(
    "index",
    {
        repoId: REPO_ID,
        repo: REPO_FULL_NAME,
        sha: branch.commit.sha,
        installationId: INSTALLATION_ID,
    },
    { jobId: `index-${REPO_FULL_NAME}-${branch.commit.sha}` },
);

console.log(`Enqueued job ${job.id} for ${REPO_FULL_NAME}@${branch.commit.sha}`);
console.log(`Run "bun run start:index" (if not already running) to process it.`);

await connection.quit();
