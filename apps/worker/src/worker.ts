import { Worker, Job } from 'bullmq';
import dotenv from "dotenv";
import IORedis from "ioredis";
import path from "node:path";
import type { PrReviewJob } from '@rio/shared-types';
import { Octokit } from 'octokit';
import { createAppAuth } from "@octokit/auth-app";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") }); // root: REDIS_URL
dotenv.config({ path: path.resolve(__dirname, "../.env") });        // local: APP_ID, PRIVATE_KEY

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

const reviewedShas = new Set<string>();

async function postFailureComment(
    octokit: Octokit,
    owner: string,
    repoName: string,
    prNumber: number,
) {
    await octokit.rest.issues.createComment({
        owner,
        repo: repoName,
        issue_number: prNumber,
        body: "⚠️ Rio review failed for this commit — will retry automatically.\n\n<!-- rio-failure -->",
    });
}

const worker = new Worker<PrReviewJob>("pr-review", async (job: Job<PrReviewJob>) => {
    const { repo, prNumber, headSha, installationId } = job.data;

    if (reviewedShas.has(headSha)) return;

    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName) throw new Error(`Malformed repo full_name : ${repo}`);

    const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
            appId: process.env.APP_ID,
            privateKey: process.env.PRIVATE_KEY!.replace(/\\n/g, "\n"),
            installationId,
        },
    });

    try {
        const { data: diff } = await octokit.rest.pulls.get({
            owner,
            repo: repoName,
            pull_number: prNumber,
            mediaType: { format: "diff" },
        });

        const res = await fetch(`${process.env.AI_ENGINE_URL ?? "http://localhost:8000"}/v1/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ diff: diff as unknown as string }),
        });

        if (!res.ok) {
            throw new Error(`ai-engine returned ${res.status}`);
        }

        const { findings } = await res.json() as {
            findings: { file: string; line: number; severity: string; message: string; rationale: string }[];
        };

        if (findings.length > 0) {
            await octokit.rest.pulls.createReview({
                owner,
                repo: repoName,
                pull_number: prNumber,
                commit_id: headSha,
                event: "COMMENT",
                comments: findings.map(f => ({
                    path: f.file,
                    line: f.line,
                    body: `**[${f.severity}]** ${f.message}\n\n${f.rationale}`,
                })),
            });
        }

        reviewedShas.add(headSha);
    } catch (err) {
        try {
            await postFailureComment(octokit, owner, repoName, prNumber);
        } catch (commentErr) {
            console.error("Failed to post failure comment:", commentErr);
        }
        throw err;
    }
}, { connection });
