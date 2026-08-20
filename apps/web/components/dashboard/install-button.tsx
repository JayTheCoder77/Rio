"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function InstallButton({
  children,
  pendingLabel,
  variant,
  size,
  className,
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      className={className}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}