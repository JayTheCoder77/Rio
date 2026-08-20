import { auth } from "@/auth";
import { createInstallState } from "@/lib/install-state";
import { reconcileUserInstallations } from "@/lib/github-reconciliation";
import { redirect } from "next/navigation";
import { CheckCircle2, GitFork, ShieldAlert, AlertTriangle, Info, GitPullRequest } from "lucide-react";
import { getUserRepos, getReviewStats, getRecentReviews } from "@rio/db";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { InstallButton } from "@/components/dashboard/install-button";

const RECENT_REVIEWS_LIMIT = 5;

const INSTALL_ERROR_MESSAGES: Record<string, string> = {
  missing_params:
    "Couldn't complete the GitHub install — the response was missing details. Please try again.",
  invalid_state:
    "That install link was invalid or had expired. Please try installing again.",
  not_found:
    "We couldn't find that GitHub installation. It may still be syncing — try again in a few seconds.",
};

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  running: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  pending: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

async function startInstall() {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const state = await createInstallState(session.user.id);
  const slug = process.env.GITHUB_APP_SLUG;

  redirect(`https://github.com/apps/${slug}/installations/new?state=${state}`);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ install_error?: string; installed?: string }>;
}) {
  const { install_error, installed } = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;

  if (userId) {
    // GitHub installations can be added outside our own install callback, or
    // after a user already has a linked installation. Reconcile on each
    // dashboard load so those later installs become visible as well.
    await reconcileUserInstallations(userId);
  }

  const repos = userId ? await getUserRepos(userId) : [];
  const stats = userId ? await getReviewStats(userId) : null;
  const recentReviews = userId ? await getRecentReviews(userId, RECENT_REVIEWS_LIMIT) : [];

  const reposByAccount = repos.reduce<Record<string, typeof repos>>((acc, repo) => {
    (acc[repo.installationAccountLogin] ??= []).push(repo);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {session?.user?.email ?? "unknown"}
        </p>
      </div>

      {installed === "1" && (
        <div className="flex items-center gap-2 rounded-[10px] border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          GitHub App connected — Rio will review pull requests on the repos you
          selected.
        </div>
      )}

      {install_error && (
        <div className="flex items-center gap-2 rounded-[10px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {INSTALL_ERROR_MESSAGES[install_error] ??
            "Something went wrong connecting GitHub. Please try again."}
        </div>
      )}

      {repos.length === 0 ? (
        <Card>
          <CardHeader>
            <GitFork className="size-6 text-foreground" />
            <CardTitle className="mt-2">No repositories connected yet</CardTitle>
            <CardDescription>
              Install the GitHub App on a repo to start getting automatic PR
              reviews.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={startInstall}>
              <InstallButton size="lg" pendingLabel="Opening GitHub...">
                Install Rio on GitHub
              </InstallButton>
            </form>
            <p className="text-xs text-muted-foreground">
              You&apos;ll be taken to GitHub to choose which repos Rio can
              access. Reviews start automatically when you open a pull request.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={GitPullRequest}
              label="Total reviews"
              value={stats?.totalReviews ?? 0}
              featured
            />
            <StatCard
              icon={ShieldAlert}
              label="Critical findings"
              value={stats?.unresolvedFindings.critical ?? 0}
              tone="destructive"
            />
            <StatCard
              icon={AlertTriangle}
              label="Warning findings"
              value={stats?.unresolvedFindings.warning ?? 0}
              tone="warning"
            />
            <StatCard
              icon={Info}
              label="Info findings"
              value={stats?.unresolvedFindings.info ?? 0}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                Your most recent pull request reviews.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentReviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No reviews yet — open a pull request on a connected repo to
                  see activity here.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {recentReviews.map((review) => (
                    <li
                      key={review.id}
                      className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-background px-3 py-2"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <GitPullRequest className="size-4 text-muted-foreground" />
                        <span className="font-medium">{review.repoFullName}</span>
                        <span className="text-muted-foreground">#{review.prNumber}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          {review.findingsCount} finding
                          {review.findingsCount === 1 ? "" : "s"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium capitalize ${
                            STATUS_STYLES[review.status] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {review.status}
                        </span>
                        <span className="text-muted-foreground">
                          {review.createdAt.toLocaleDateString()}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            {Object.entries(reposByAccount).map(([account, accountRepos]) => (
              <Card key={account}>
                <CardHeader>
                  <CardTitle>{account}</CardTitle>
                  <CardDescription>
                    {accountRepos.length} connected repositor
                    {accountRepos.length === 1 ? "y" : "ies"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {accountRepos.map((repo) => (
                      <li
                        key={repo.id}
                        className="flex items-center gap-2 rounded-[10px] border border-border bg-background px-3 py-2 text-sm"
                      >
                        <GitFork className="size-4 text-muted-foreground" />
                        <span className="font-medium">{repo.fullName}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
            <Card className="mt-1">
              <CardContent className="flex flex-col items-start justify-between gap-4 py-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-medium">Connect another repo</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    You&apos;ll choose the repos or organizations on GitHub.
                  </p>
                </div>
                <form action={startInstall}>
                  <InstallButton pendingLabel="Opening GitHub...">
                    Install on GitHub
                  </InstallButton>
                </form>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  featured,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: number;
  tone?: "destructive" | "warning";
  featured?: boolean;
}) {
  return (
    <Card
      className={
        featured
          ? "border-transparent ring-2 ring-[color:var(--ring)] hover:border-transparent"
          : undefined
      }
    >
      <CardContent className="flex items-center gap-3 pt-6">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${
            tone === "destructive"
              ? "bg-destructive/10 text-destructive"
              : tone === "warning"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : featured
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="size-4.5" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-2xl font-medium tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
