import Image from "next/image";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { getUserModelCredentialSummary } from "@rio/db";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConnectModelCredentialForm } from "./connect-model-form";
import { DisconnectModelButton } from "./disconnect-model-button";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard/settings");

  const { name, email, image } = session.user;
  const modelCredential = session.user.id
    ? await getUserModelCredentialSummary(session.user.id)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Synced from your GitHub account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {image ? (
              <div className="relative size-14 shrink-0 overflow-hidden rounded-full border border-border">
                <Image src={image} alt="" fill sizes="56px" className="object-cover" />
              </div>
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {(name ?? email ?? "?").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium">{name ?? "Unknown"}</p>
              {/* <p className="text-sm text-muted-foreground">{email ?? "No email"}</p> */}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LLM Provider</CardTitle>
          <CardDescription>
            Connect your own Groq or OpenRouter key. Rio uses it to power reviews for
            your repos and the CLI — no review runs without one configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {modelCredential ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-sm">
                <span className="font-medium capitalize text-foreground">
                  {modelCredential.provider}
                </span>
                <span className="text-muted-foreground">{modelCredential.modelName}</span>
                <span className="rounded-[4px] bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  ••••{modelCredential.lastFour}
                </span>
              </div>
              <DisconnectModelButton />
            </div>
          ) : (
            <ConnectModelCredentialForm />
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/20 hover:border-destructive/30">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Sign out of Rio on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button variant="outline" type="submit">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
