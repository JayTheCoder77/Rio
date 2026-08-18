"use client";

import { useActionState, useRef, useEffect } from "react";
import { createApiKeyAction } from "./actions";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/code-block";

const initialState = { plaintext: null, error: null };

export function CreateApiKeyForm() {
  const [state, formAction, isPending] = useActionState(createApiKeyAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.plaintext) formRef.current?.reset();
  }, [state.plaintext]);

  return (
    <div className="flex flex-col gap-3">
      <form ref={formRef} action={formAction} className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="key-name" className="text-sm font-medium">
            Key name
          </label>
          <input
            id="key-name"
            name="name"
            placeholder="e.g. CLI on laptop"
            required
            className="h-9 rounded-[10px] border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create key"}
        </Button>
      </form>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      {state.plaintext && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-muted-foreground">
            Copy this key now — you won&apos;t be able to see it again.
          </p>
          <CodeBlock code={state.plaintext} />
        </div>
      )}
    </div>
  );
}
