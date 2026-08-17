import Link from "next/link";
import { Terminal, GitFork, FileCode, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { CodeBlock } from "@/components/code-block";

const CLI_INSTALL_COMMANDS = [
  {
    value: "uv",
    label: "uv",
    command: "uv tool install git+https://github.com/rio-dev/rio.git#subdirectory=apps/cli",
  },
  {
    value: "pipx",
    label: "pipx",
    command: "pipx install git+https://github.com/rio-dev/rio.git#subdirectory=apps/cli",
  },
];

const RIO_YML_EXAMPLE = `# .rio.yml — place at the root of your repo
ignore_paths:
  - "vendor/**"
  - "**/*.generated.ts"

# Findings below this severity are dropped before Rio comments.
# One of: critical, warning, info
min_severity: warning

# Caps the number of inline comments Rio leaves on a single PR.
# If more findings pass the severity filter than this, the most
# severe ones are kept and the rest are silently dropped.
max_comments_per_pr: 10

# If true, Rio creates a GitHub Check Run on each PR that fails
# whenever the review finds any critical-severity issue. Off by
# default — turning this on is what lets you require Rio to pass
# via GitHub's branch protection settings.
require_check: false
`;

export default function DocsPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Docs
        </h1>
        <p className="mt-3 text-muted-foreground">
          Everything you need to get Rio reviewing your pull requests, or
          running locally from the CLI.
        </p>
      </div>

      <div className="mt-12 flex flex-col gap-10">
        {/* Getting started */}
        <Card>
          <CardHeader>
            <GitFork className="size-6 text-foreground" />
            <CardTitle className="mt-2">Getting started</CardTitle>
            <CardDescription>
              Two ways to use Rio — pick one or use both.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-medium">1. GitHub App (recommended)</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Install the GitHub App on a repo and Rio automatically
                reviews every pull request — inline comments, a summary,
                and a pass/fail check.
              </p>
              <Button className="mt-3" render={<Link href="/install" />}>
                Install on GitHub
              </Button>
            </div>
            <div>
              <h3 className="text-sm font-medium">2. CLI</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Review staged, uncommitted, or committed changes locally,
                with no GitHub connection required.
              </p>
              <div className="mt-3">
                <Tabs defaultValue="uv">
                  <TabsList>
                    {CLI_INSTALL_COMMANDS.map((pkg) => (
                      <TabsTab key={pkg.value} value={pkg.value}>
                        {pkg.label}
                      </TabsTab>
                    ))}
                  </TabsList>
                  {CLI_INSTALL_COMMANDS.map((pkg) => (
                    <TabsPanel key={pkg.value} value={pkg.value}>
                      <CodeBlock code={pkg.command} />
                    </TabsPanel>
                  ))}
                </Tabs>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Coming soon:{" "}
                <code className="font-mono">pip install rio-cli</code> once
                published to PyPI.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* CLI reference */}
        <Card>
          <CardHeader>
            <Terminal className="size-6 text-foreground" />
            <CardTitle className="mt-2">CLI reference</CardTitle>
            <CardDescription>
              Run from inside any git repository.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <CodeBlock code="rio review --staged" />
              <p className="mt-2 text-sm text-muted-foreground">
                Reviews changes that are staged (<code className="font-mono">git add</code>-ed) but not yet committed.
              </p>
            </div>
            <div>
              <CodeBlock code="rio review --uncommitted" />
              <p className="mt-2 text-sm text-muted-foreground">
                Reviews all uncommitted changes in the working tree, staged or not.
              </p>
            </div>
            <div>
              <CodeBlock code="rio review --committed" />
              <p className="mt-2 text-sm text-muted-foreground">
                Reviews commits on your current branch that haven&apos;t been pushed to its upstream yet.
              </p>
            </div>
            <div>
              <CodeBlock code="rio review --diff path/to/file.diff" />
              <p className="mt-2 text-sm text-muted-foreground">
                Reviews a diff from a file instead of your working tree — useful for CI or scripting.
              </p>
            </div>
            <div>
              <CodeBlock code="rio review --include-untracked" />
              <p className="mt-2 text-sm text-muted-foreground">
                Add this to any of the above to also review new, untracked files (treated as entirely-added diffs).
              </p>
            </div>
            <div>
              <CodeBlock code="rio review" />
              <p className="mt-2 text-sm text-muted-foreground">
                With no flags, reviews committed-but-unpushed changes plus
                anything uncommitted — whichever exist.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API key / auth */}
        <Card>
          <CardHeader>
            <Settings className="size-6 text-foreground" />
            <CardTitle className="mt-2">Authenticating the CLI</CardTitle>
            <CardDescription>
              Optional — the CLI works without a key, on Rio&apos;s free tier.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Generate an API key from your{" "}
              <Link href="/dashboard/api-keys" className="underline">
                dashboard
              </Link>
              , then add it to your CLI config file at{" "}
              <code className="font-mono">~/.config/rio/config.toml</code>:
            </p>
            <CodeBlock
              code={`[api]\nurl = "http://localhost:8000"\napi_key = "rio_..."`}
            />
            <p className="text-sm text-muted-foreground">
              Keep this file private — anyone with your key can use your
              account&apos;s review quota. Revoke a key any time from the
              dashboard if it&apos;s ever exposed.
            </p>
          </CardContent>
        </Card>

        {/* .rio.yml reference */}
        <Card>
          <CardHeader>
            <FileCode className="size-6 text-foreground" />
            <CardTitle className="mt-2">.rio.yml reference</CardTitle>
            <CardDescription>
              Drop this file at the root of your repo to tune what Rio
              comments on. Every field is optional — an absent or missing
              file just means Rio uses these defaults.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <CodeBlock code={RIO_YML_EXAMPLE} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium">ignore_paths</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  List of glob patterns. Files matching any pattern are
                  excluded before Rio ever sees them. Default: none.
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">min_severity</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  One of <code className="font-mono">critical</code>,{" "}
                  <code className="font-mono">warning</code>,{" "}
                  <code className="font-mono">info</code>. Findings below
                  this are dropped. Default:{" "}
                  <code className="font-mono">info</code> (nothing filtered).
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">max_comments_per_pr</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Caps inline comments per review. Most severe findings are
                  kept first. Default: <code className="font-mono">10</code>.
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">require_check</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  If <code className="font-mono">true</code>, Rio creates a
                  GitHub Check Run that fails when the review finds any
                  critical issue. Default:{" "}
                  <code className="font-mono">false</code>.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              This file is read from the exact commit being reviewed, so a
              PR that changes <code className="font-mono">.rio.yml</code>{" "}
              takes effect on itself.
            </p>
            <p className="text-sm text-muted-foreground">
              <code className="font-mono">require_check</code> only creates
              the check — it doesn&apos;t block merging by itself. To
              actually require it, go to your repo&apos;s{" "}
              <strong>Settings → Branches → Branch protection rules</strong>,
              edit (or add) a rule for your target branch, and add{" "}
              <code className="font-mono">Rio</code> under &quot;Require
              status checks to pass before merging.&quot;
            </p>
          </CardContent>
        </Card>

        {/* Self-hosting note */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Rio is open architecture, not a black box — the GitHub App,
              worker, and AI engine are separate services that only talk
              over HTTP. Self-hosting docs are on the way; for now, the
              hosted version at this dashboard is the easiest way to run
              Rio.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
