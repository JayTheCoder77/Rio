import { Worker, Job } from "bullmq";
import dotenv from "dotenv";
import IORedis from "ioredis";
import path from "node:path";
import type { IndexRepoJob } from "@rio/shared-types";
import { createAppAuth } from "@octokit/auth-app";
import { cloneRepo } from "./clone";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") }); // root: REDIS_URL
dotenv.config({ path: path.resolve(__dirname, "../.env") });        // local: APP_ID, PRIVATE_KEY

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

const auth = createAppAuth({
    appId: process.env.APP_ID!,
    privateKey: process.env.PRIVATE_KEY!.replace(/\\n/g, "\n"),
});

const indexWorker = new Worker<IndexRepoJob>("index-repo", async (job: Job<IndexRepoJob>) => {
    const { repoId, repo, sha, installationId } = job.data;

    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName) throw new Error(`Malformed repo full_name : ${repo}`);

    const { token } = await auth({ type: "installation", installationId });

    const { path: repoPath, cleanup } = await cloneRepo(owner, repoName, sha, token);

    try {
        const res = await fetch(`${process.env.AI_ENGINE_URL ?? "http://localhost:8000"}/v1/index/repo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repo_path: repoPath, repo_id: repoId }),
        });

        if (!res.ok) {
            throw new Error(`ai-engine returned ${res.status}`);
        }

        const { chunks_indexed } = await res.json() as { status: string; chunks_indexed: number };
        console.log(`Indexed ${repo}@${sha}: ${chunks_indexed} chunks`);
    } finally {
        await cleanup();
    }
}, { connection });

indexWorker.on("failed", (job, err) => {
    console.error(`index-repo job ${job?.id} failed:`, err);
});
