import { Worker, Job } from 'bullmq';
import dotenv from "dotenv";
import IORedis from "ioredis";
import path from "node:path";
import type { PrReviewJob } from '@rio/shared-types';
import { Octokit } from 'octokit';
import { createAppAuth } from "@octokit/auth-app";
import { db, repos, reviews, findings, installations, getInstallationOwnerId } from "@rio/db";
import { eq, and } from "drizzle-orm";
import YAML from 'yaml';
import { cloneRepo } from './clone';

dotenv.config({ path: path.resolve(__dirname, "../../../.env") }); // root: REDIS_URL
dotenv.config({ path: path.resolve(__dirname, "../.env") });        // local: APP_ID, PRIVATE_KEY, INTERNAL_SERVICE_TOKEN

if (!process.env.INTERNAL_SERVICE_TOKEN) {
    throw new Error(
        "INTERNAL_SERVICE_TOKEN is not set. This worker authenticates to ai-engine's " +
        "/v1/review as a trusted internal caller (not a per-user Rio API key) — see " +
        "app.auth.verify_internal_service_token in services/ai-engine."
    );
}

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

const auth = createAppAuth({
    appId: process.env.APP_ID!,
    privateKey: process.env.PRIVATE_KEY!.replace(/\\n/g, "\n"),
});

async function fetchRioConfig(
    octokit: Octokit,
    owner: string,
    repoName: string,
    ref: string
): Promise<Record<string, unknown> | undefined> {
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner,
            repo: repoName,
            path: ".rio.yml",
            ref,
        })
        if (!("content" in data)) return undefined;

        const decoded = Buffer.from(data.content, "base64").toString("utf-8");
        return YAML.parse(decoded);
    } catch (err) {
        return undefined;
    }
}

/** A known, specific failure (bad model name, revoked provider key, etc.)
 * where automatically retrying the same job would just fail identically —
 * distinct from transient errors (network blips, rate limits) where the
 * generic "will retry automatically" comment is still accurate. */
class NonRetryableReviewError extends Error { }

async function postFailureComment(
    octokit: Octokit,
    owner: string,
    repoName: string,
    prNumber: number,
    reason?: string,
) {
    const body = reason
        ? `⚠️ Rio review failed for this commit: ${reason}\n\n<!-- rio-failure -->`
        : "⚠️ Rio review failed for this commit — will retry automatically.\n\n<!-- rio-failure -->";
    await octokit.rest.issues.createComment({
        owner,
        repo: repoName,
        issue_number: prNumber,
        body,
    });
}

function getRequireCheck(config: Record<string, unknown> | undefined): boolean {
    return typeof config?.require_check === "boolean" && config.require_check;
}

async function getChangedFiles(octokit: Octokit, owner: string, repoName: string, prNumber: number): Promise<string[]> {
    const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
        owner,
        repo: repoName,
        pull_number: prNumber,
        per_page: 100,
    });
    return files.map((f) => f.filename);
}

async function fetchLintResults(
    repoPath: string,
    changedFiles: string[],
): Promise<unknown[]> {
    try {
        const res = await
            fetch(`${process.env.SANDBOX_RUNNER_URL ??
                "http://localhost:8001"}/v1/verify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    repo_path: repoPath,
                    changed_files: changedFiles
                }),
            });
        if (!res.ok) return [];
        const { lint_results } = await res.json() as {
            lint_results: unknown[]
        };
        return lint_results;
    } catch {
        return []; // best-effort — sandbox signal is optional, never fails the review
    }
}

const worker = new Worker<PrReviewJob>("pr-review", async (job: Job<PrReviewJob>) => {
    const { repo, prNumber, headSha, baseSha, installationId, githubRepoId } = job.data;

    const [existing] = await db.select({ id: reviews.id })
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

    const [existingRepoRow] = await db.select({ id: repos.id })
        .from(repos)
        .where(eq(repos.githubRepoId, githubRepoId))
        .limit(1);

    const [inst] = await db.select({ id: installations.id })
        .from(installations)
        .where(eq(installations.githubInstallationId, installationId))
        .limit(1);

    if (!inst) throw new Error(`Installation ${installationId} not found`);

    // BYOK: resolve which Rio user's provider credential powers this review.
    // See `getInstallationOwnerId` for the "earliest-linked user" tradeoff —
    // this is a known simplification, not a full multi-user-per-installation
    // credential model.
    const onBehalfOfUserId = await getInstallationOwnerId(inst.id);

    try {
        const { data: diff } = await octokit.rest.pulls.get({
            owner,
            repo: repoName,
            pull_number: prNumber,
            mediaType: { format: "diff" },
        });

        const rioConfig = await fetchRioConfig(octokit, owner, repoName, headSha);

        const { token } = await auth({ type: "installation", installationId });
        let lintResults: unknown[] = [];
        try {
            const { path: repoPath, cleanup } = await cloneRepo(owner, repoName, headSha, token);
            try {
                const changedFiles = await getChangedFiles(octokit, owner, repoName, prNumber);
                lintResults = await fetchLintResults(repoPath, changedFiles);
            } finally {
                await cleanup();
            }
        } catch {
            // clone failed — proceed without sandbox corroboration
        }

        if (!onBehalfOfUserId) {
            throw new Error(
                `No Rio user linked to installation ${installationId} — cannot resolve a BYOK credential.`
            );
        }

        const res = await fetch(`${process.env.AI_ENGINE_URL ?? "http://localhost:8000"}/v1/review`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-Service-Token": process.env.INTERNAL_SERVICE_TOKEN!,
            },
            body: JSON.stringify({
                diff: diff as unknown as string,
                repo_id: existingRepoRow?.id,
                on_behalf_of_user_id: onBehalfOfUserId,
                ...(rioConfig ? { config: rioConfig } : {}),
                lint_results: lintResults,
            }),
        });

        if (res.status === 412 || res.status === 422) {
            const { detail } = await res.json() as { detail: string };
            throw new NonRetryableReviewError(detail);
        }
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

        if (getRequireCheck(rioConfig)) {
            const hasCritical = engineFindings.some(f => f.severity === "critical");
            await octokit.rest.checks.create({
                owner,
                repo: repoName,
                name: "Rio",
                head_sha: headSha,
                status: "completed",
                conclusion: hasCritical ? "failure" : "success",
                output: {
                    title: hasCritical
                        ? "Rio found unresolved critical issues"
                        : "Rio review passed",
                    summary: hasCritical
                        ? `${engineFindings.filter(f => f.severity === "critical").length} critical finding(s) - see inline comments`
                        : "No critical findings"
                }
            })
        }

        const [repoRow] = await db.insert(repos)
            .values({ installationId: inst.id, githubRepoId, fullName: repo })
            .onConflictDoUpdate({
                target: repos.githubRepoId,
                set: { fullName: repo },
            })
            .returning({ id: repos.id });

        if (!repoRow) return;

        await db.transaction(async (tx) => {
            const [rev] = await tx.insert(reviews)
                .values({ repoId: repoRow.id, prNumber, headSha, status: 'completed' })
                .onConflictDoNothing()
                .returning({ id: reviews.id });

            if (!rev) return;

            if (engineFindings.length > 0) {
                await tx.insert(findings).values(
                    engineFindings.map(f => ({
                        reviewId: rev.id,
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
            const reason = err instanceof NonRetryableReviewError ? err.message : undefined;
            await postFailureComment(octokit, owner, repoName, prNumber, reason);
        } catch (commentErr) {
            console.error("Failed to post failure comment:", commentErr);
        }
        throw err;
    }
}, { connection });
