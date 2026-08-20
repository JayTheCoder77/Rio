"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { DOCS_HEADINGS, DOCS_NAV } from "./nav";

function useScrollSpy() {
  const [activeId, setActiveId] = React.useState<string>(DOCS_HEADINGS[0] ?? "");

  React.useEffect(() => {
    const onScroll = () => {
      const offset = 120;
      let current = DOCS_HEADINGS[0] ?? "";
      for (const id of DOCS_HEADINGS) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= offset) current = id;
        else break;
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return activeId;
}

function SearchBox({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-[10px] border border-border bg-muted px-3 py-2">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search docs"
        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

function NavList({
  query,
  activeId,
  onNavigate,
}: {
  query: string;
  activeId: string;
  onNavigate?: () => void;
}) {
  const q = query.trim().toLowerCase();
  const linkClass =
    "text-sm text-muted-foreground transition-colors hover:text-foreground";
  const linkClassActive = "font-medium text-foreground";

  return (
    <nav className="flex flex-col gap-5">
      {DOCS_NAV.map((group) => {
        const groupMatches = !q || group.label.toLowerCase().includes(q);
        const items = group.items.filter(
          (item) => !q || item.label.toLowerCase().includes(q),
        );
        if (q && !groupMatches && items.length === 0) return null;

        return (
          <div key={group.id}>
            <a
              href={`#${group.id}`}
              onClick={onNavigate}
              className={cn(
                linkClass,
                activeId === group.id && linkClassActive,
              )}
            >
              {group.label}
            </a>
            {group.items.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5 border-l border-border pl-3">
                {items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={onNavigate}
                      className={cn(
                        linkClass,
                        activeId === item.id && linkClassActive,
                      )}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function DocsShell({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = React.useState("");
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const activeId = useScrollSpy();

  const navList = (
    <NavList
      query={query}
      activeId={activeId}
      onNavigate={() => setMobileOpen(false)}
    />
  );

  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-6 py-12 sm:px-10">
      {/* Mobile: docs title + nav sheet */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between">
          <Link
            href="/docs"
            className="text-sm font-medium text-foreground"
          >
            Docs
          </Link>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Docs menu" />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle>Docs</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6">
                <SearchBox query={query} onQueryChange={setQuery} />
                {navList}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-10 flex max-h-[calc(100vh-5rem)] flex-col gap-5 overflow-y-auto pr-2">
          <SearchBox query={query} onQueryChange={setQuery} />
          {navList}
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}