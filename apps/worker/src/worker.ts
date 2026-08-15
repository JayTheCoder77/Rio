import { Worker, Job } from 'bullmq';
import dotenv from "dotenv";
import IORedis from "ioredis";
import path from "node:path";
import type { PrReviewJob } from '@rio/shared-types';
import { Octokit } from 'octokit';
import { createAppAuth } from "@octokit/auth-app";
import { db, repos, reviews, findings, installations } from "@rio/db";
import { eq, and } from "drizzle-orm";
import YAML from 'yaml';

dotenv.config({ path: path.resolve(__dirname, "../../../.env") }); // root: REDIS_URL
dotenv.config({ path: path.resolve(__dirname, "../.env") });        // local: APP_ID, PRIVATE_KEY

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

async function fetchRioConfig(
    octokit : Octokit,
    owner : string,
    repoName : string,
    ref : string
) : Promise<Record<string , unknown > | undefined> {
    try {
        const {data} = await octokit.rest.repos.getContent({
            owner ,
            repo : repoName,
            path : ".rio.yml",
            ref,
        })
        if(!("content" in data)) return undefined;

        const decoded = Buffer.from(data.content , "base64").toString("utf-8");
        return YAML.parse(decoded);
    } catch(err){
        return undefined;
    }
}

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
    const { repo, prNumber, headSha, installationId, githubRepoId } = job.data;
    
    const [existing] = await db.select({ id : reviews.id })
    .from(reviews)
    .where(and(
        eq(reviews.headSha, headSha),
        eq(reviews.status, 'completed'),
    ))
    .limit(1)

    if (existing) return;

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

    const [existingRepoRow] = await db.select({id : repos.id})
        .from(repos)
        .where(eq(repos.githubRepoId , githubRepoId))
        .limit(1);

    try {
        const { data: diff } = await octokit.rest.pulls.get({
            owner,
            repo: repoName,
            pull_number: prNumber,
            mediaType: { format: "diff" },
        });

        const rioConfig = await fetchRioConfig(octokit , owner , repoName, headSha);

        const res = await fetch(`${process.env.AI_ENGINE_URL ?? "http://localhost:8000"}/v1/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ diff: diff as unknown as string , repo_id : existingRepoRow?.id,
            ...(rioConfig ? {config : rioConfig} : {}),
             }),
        });

        if (!res.ok) {
            throw new Error(`ai-engine returned ${res.status}`);
        }

        const { findings: engineFindings } = await res.json() as {
            findings: { file: string; line: number; severity: string; message: string; rationale: string }[];
        };

        if (engineFindings.length > 0) {

            await octokit.rest.pulls.createReview({
                owner,
                repo: repoName,
                pull_number: prNumber,
                commit_id: headSha,
                event: "COMMENT",
                comments: engineFindings.map(f => ({
                    path: f.file,
                    line: f.line,
                    body: `**[${f.severity}]** ${f.message}\n\n${f.rationale}`,
                })),
            });
        }

        const [inst] = await db.select({id : installations.id})
            .from(installations)
            .where(eq(installations.githubInstallationId, installationId))
            .limit(1);
        
        if (!inst) throw new Error(`Installation ${installationId} not found`);

        const [repoRow] = await db.insert(repos)
            .values({installationId : inst.id , githubRepoId , fullName : repo})
            .onConflictDoUpdate({
                target : repos.githubRepoId,
                set : {fullName : repo},
            })
            .returning({id : repos.id});
        
        if (!repoRow) return;

        await db.transaction(async (tx) => {
            const [rev] = await tx.insert(reviews)
                .values({repoId: repoRow.id, prNumber, headSha, status: 'completed'})
                .onConflictDoNothing()
                .returning({id : reviews.id});
                
                if (!rev) return;
                
                if (engineFindings.length > 0) {
                    await tx.insert(findings).values(
                        engineFindings.map(f => ({
                            reviewId : rev.id,
                            file: f.file,
                            line: f.line,
                            severity: f.severity as "critical" | "warning" | "info",
                            message: f.message,
                            rationale: f.rationale,
                        }))
                    );
                }
        });

        
    } catch (err) {
        try {
            await postFailureComment(octokit, owner, repoName, prNumber);
        } catch (commentErr) {
            console.error("Failed to post failure comment:", commentErr);
        }
        throw err;
    }
}, { connection });
