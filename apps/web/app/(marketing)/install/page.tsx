import Link from "next/link";
import { GitFork, Terminal } from "lucide-react";

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

export default function InstallPage() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Install Rio
        </h1>
        <p className="mt-3 text-muted-foreground">
          Connect a GitHub repo for automatic PR reviews, or review diffs
          locally from the CLI.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <GitFork className="size-6 text-foreground" />
            <CardTitle className="mt-2">GitHub App</CardTitle>
            <CardDescription>
              Rio reviews every pull request automatically — inline
              comments, a summary, and a pass/fail check.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" className="w-full" render={<Link href="/dashboard" />}>
              Install on GitHub
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Terminal className="size-6 text-foreground" />
            <CardTitle className="mt-2">CLI</CardTitle>
            <CardDescription>
              Review staged, uncommitted, or committed changes locally —
              no GitHub connection required.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
            <p className="mt-3 text-xs text-muted-foreground">
              Then run <code className="font-mono">rio review --staged</code>{" "}
              from inside a git repo.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
