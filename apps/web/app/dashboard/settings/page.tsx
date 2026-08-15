import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard/settings");

  const { name, email, image } = session.user;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt=""
                className="size-14 shrink-0 rounded-full border border-border"
              />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {(name ?? email ?? "?").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium">{name ?? "Unknown"}</p>
              <p className="text-sm text-muted-foreground">{email ?? "No email"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
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
