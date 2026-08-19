"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { saveModelCredentialAction } from "./model-credential-actions";
import { Button } from "@/components/ui/button";

const MODEL_PLACEHOLDER = {
  groq: "e.g. llama-3.3-70b-versatile",
  openrouter: "e.g. anthropic/claude-3.5-sonnet",
} as const;

const initialState = { error: null, success: false };

export function ConnectModelCredentialForm() {
  const [state, formAction, isPending] = useActionState(saveModelCredentialAction, initialState);
  const [provider, setProvider] = useState<"groq" | "openrouter">("groq");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="provider" className="text-sm font-medium">
          Provider
        </label>
        <select
          id="provider"
          name="provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as "groq" | "openrouter")}
          className="h-9 rounded-[10px] border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="groq">Groq</option>
          <option value="openrouter">OpenRouter</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="model" className="text-sm font-medium">
          Model
        </label>
        <input
          id="model"
          name="model"
          type="text"
          autoComplete="off"
          placeholder={MODEL_PLACEHOLDER[provider]}
          required
          className="h-9 rounded-[10px] border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p className="text-xs text-muted-foreground">
          Any model id your {provider === "groq" ? "Groq" : "OpenRouter"} account can call.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="api_key" className="text-sm font-medium">
          API key
        </label>
        <input
          id="api_key"
          name="api_key"
          type="password"
          autoComplete="off"
          placeholder={provider === "groq" ? "gsk_..." : "sk-or-..."}
          required
          className="h-9 rounded-[10px] border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Provider connected.
        </p>
      )}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Connecting..." : "Connect provider"}
      </Button>
    </form>
  );
}
