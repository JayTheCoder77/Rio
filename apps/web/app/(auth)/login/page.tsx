import { GitFork } from "lucide-react";

import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <GitFork className="size-6 text-foreground" />
        <CardTitle className="mt-2">Sign in to Rio</CardTitle>
        <CardDescription>
          Connect your GitHub account to manage installations, API keys,
          and review analytics.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: callbackUrl ?? "/dashboard" });
          }}
        >
          <Button type="submit" size="lg" className="w-full">
            <GitFork />
            Sign in with GitHub
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
