import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserApiKeys } from "@rio/db";
import { KeyRound } from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CreateApiKeyForm } from "./create-form";
import { RevokeKeyButton } from "./revoke-button";

export default async function ApiKeysPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const keys = await getUserApiKeys(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use API keys to authenticate the Rio CLI.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create a new key</CardTitle>
          <CardDescription>
            Give it a name so you can tell your keys apart later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateApiKeyForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your keys</CardTitle>
          <CardDescription>
            {keys.length === 0
              ? "You haven't created any API keys yet."
              : `${keys.length} active key${keys.length === 1 ? "" : "s"}.`}
          </CardDescription>
        </CardHeader>
        {keys.length > 0 && (
          <CardContent>
            <ul className="flex flex-col gap-2">
              {keys.map((key) => (
                <li
                  key={key.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <KeyRound className="size-4 text-muted-foreground" />
                    <span className="font-medium">{key.name}</span>
                    <span className="font-mono text-muted-foreground">
                      ••••{key.lastFour}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      Created {key.createdAt.toLocaleDateString()}
                    </span>
                    <RevokeKeyButton keyId={key.id} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
