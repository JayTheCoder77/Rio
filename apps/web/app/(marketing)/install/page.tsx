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
      <div>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
          Get started with Rio
        </h1>
        <p className="mt-3 text-muted-foreground">
          Choose how you want to use Rio.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-muted">
                <GitFork className="size-5 text-foreground" />
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Recommended for most teams
              </span>
            </div>
            <CardTitle className="mt-4 text-xl">GitHub App</CardTitle>
            <CardDescription>
              Rio reviews every pull request automatically — inline
              comments, a summary, and a pass/fail check.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button size="lg" className="w-full" render={<Link href="/dashboard" />}>
              Install on GitHub
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-muted">
              <Terminal className="size-5 text-foreground" />
            </div>
            <CardTitle className="mt-4 text-xl">CLI</CardTitle>
            <CardDescription>
              Review staged, uncommitted, or committed changes locally —
              no GitHub connection required.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto flex flex-col gap-3">
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
            <p className="text-xs text-muted-foreground">
              Then run <code className="font-mono">rio review --staged</code>{" "}
              from inside a git repo. Requires an API key (create one after
              signing in).
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
      </p>
    </section>
  );
}