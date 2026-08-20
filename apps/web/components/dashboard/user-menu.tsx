"use client";

import Image from "next/image";

import { LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

function getInitials(name?: string | null, email?: string | null) {
  const source = name ?? email ?? "?";
  return source.trim().slice(0, 2).toUpperCase();
}

export function UserMenu({
  name,
  email,
  image,
  onSignOut,
  className,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  /** Server action (or handler) that performs the actual sign-out — wire your own `signOut()` call here. */
  onSignOut: () => void | Promise<void>;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors duration-200 hover:bg-sidebar-accent/60",
          className
        )}
      >
        {image ? (
          <div className="relative size-8 shrink-0 overflow-hidden rounded-full border border-sidebar-border">
            <Image src={image} alt="" fill sizes="32px" className="object-cover" />
          </div>
        ) : (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-medium text-sidebar-primary-foreground">
            {getInitials(name, email)}
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {name ?? "Unknown"}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/60">
            {email ?? ""}
          </p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="w-56">
        <DropdownMenuItem disabled className="opacity-100">
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-medium text-foreground">
              {name ?? "Unknown"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {email ?? ""}
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onSignOut()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
