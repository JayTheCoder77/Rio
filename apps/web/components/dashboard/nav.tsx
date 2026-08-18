"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  KeyRound,
  Plug,
  BookOpen,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug, comingSoon: true },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const FOOTER_ITEMS = [
  { href: "/docs", label: "Docs & Support", icon: BookOpen },
];

function NavLink({
  href,
  label,
  icon: Icon,
  comingSoon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  comingSoon?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-disabled={comingSoon}
      className={cn(
        "flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors duration-200",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        comingSoon && "pointer-events-none opacity-50"
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.5} />
      <span className="flex-1">{label}</span>
      {comingSoon && (
        <span className="rounded-full bg-sidebar-border px-1.5 py-0.5 text-[10px] font-normal text-sidebar-foreground/60">
          Soon
        </span>
      )}
    </Link>
  );
}

export function DashboardNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col justify-between">
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} onNavigate={onNavigate} />
        ))}
      </nav>
      <nav className="flex flex-col gap-1 border-t border-sidebar-border pt-3">
        {FOOTER_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} onNavigate={onNavigate} />
        ))}
      </nav>
    </div>
  );
}
