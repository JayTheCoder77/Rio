"use client";

import { useState } from "react";
import { disconnectModelCredentialAction } from "./model-credential-actions";
import { Button } from "@/components/ui/button";

export function DisconnectModelButton() {
  const [isPending, setIsPending] = useState(false);

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={async () => {
        if (!confirm("Disconnect your provider key? Reviews will stop working until you connect a new one.")) return;
        setIsPending(true);
        await disconnectModelCredentialAction();
        setIsPending(false);
      }}
    >
      {isPending ? "Disconnecting..." : "Disconnect"}
    </Button>
  );
}
