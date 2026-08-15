"use client";

import { useState } from "react";
import { revokeApiKeyAction } from "./actions";
import { Button } from "@/components/ui/button";

export function RevokeKeyButton({ keyId }: { keyId: string }) {
  const [isPending, setIsPending] = useState(false);

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={async () => {
        if (!confirm("Revoke this API key? This cannot be undone.")) return;
        setIsPending(true);
        await revokeApiKeyAction(keyId);
        setIsPending(false);
      }}
    >
      {isPending ? "Revoking..." : "Revoke"}
    </Button>
  );
}
