"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function CodeBlock({
  code,
  className,
}: {
  code: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-[10px] border border-border bg-muted px-4 py-3",
        className
      )}
    >
      <code className="overflow-x-auto whitespace-pre font-mono text-sm leading-relaxed text-foreground">
        {code}
      </code>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Copy to clipboard"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </Button>
    </div>
  )
}

export { CodeBlock }
