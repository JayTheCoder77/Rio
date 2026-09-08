import { Worker, Job } from "bullmq";
import dotenv from "dotenv";
import IORedis from "ioredis";
import path from "node:path";
import type { IndexRepoJob } from "@rio/shared-types";
import { createAppAuth } from "@octokit/auth-app";
import { cloneRepo } from "./clone";
import { walkRepo } from "./walkRepo";
import { Octokit } from "octokit";

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
        // ai-engine is a separate container — it can't see repoPath on this
        // worker's disk, so the files themselves get shipped instead.
        const files = await walkRepo(repoPath);

        const res = await fetch(`${process.env.AI_ENGINE_URL ?? "http://localhost:8000"}/v1/index/repo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files, repo_id: repoId }),
        });

        if (!res.ok) {
            throw new Error(`ai-engine returned ${res.status}`);
        }

        const { chunks_indexed } = await res.json() as { status: string; chunks_indexed: number };
        console.log(`Indexed ${repo}@${sha}: ${chunks_indexed} chunks`);

        try {
            const octokit = new Octokit({ auth: token });
            const { data: issues } = await octokit.rest.issues.listForRepo({
                owner,
                repo: repoName,
                state: "all",
                per_page: 30,
            });
            const documents = issues
                .filter((issue) => !("pull_request" in issue && issue.pull_request))
                .map((issue) => ({
                    kind: "issue" as const,
                    number: issue.number,
                    title: issue.title,
                    body: issue.body ?? "",
                    state: issue.state,
                }));
            if (documents.length > 0) {
                await fetch(`${process.env.AI_ENGINE_URL ?? "http://localhost:8000"}/v1/index/knowledge`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ repo_id: repoId, documents }),
                });
            }
        } catch (err) {
            console.error(`issue index skipped for ${repo}:`, err);
        }
    } finally {
        await cleanup();
    }
}, { connection });

indexWorker.on("failed", (job, err) => {
    console.error(`index-repo job ${job?.id} failed:`, err);
});
