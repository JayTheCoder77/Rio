"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_LINKS = [{ href: "/docs", label: "Docs" }];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="w-full bg-background px-6 py-6 sm:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="text-base font-semibold tracking-tight text-foreground">
          RIO
        </Link>

        <nav className="hidden items-center justify-self-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center justify-self-end gap-2 md:flex">
          <ThemeToggle />
          <Button
            className="gap-2.5 bg-foreground pr-2 pl-4 text-background hover:bg-foreground/90"
            render={<Link href="/install" />}
          >
            Get access
            <span className="flex size-5 items-center justify-center rounded-full bg-background/15 text-[11px] font-medium">
              A
            </span>
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={<Button variant="ghost" size="icon" aria-label="Open menu" />}
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Rio</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 px-6">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-base text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <Button
                  className="justify-start bg-foreground text-background hover:bg-foreground/90"
                  render={<Link href="/install" onClick={() => setOpen(false)} />}
                >
                  Get access
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start px-0"
                  render={<Link href="/login" onClick={() => setOpen(false)} />}
                >
                  Log in
                </Button>
                <div className="flex items-center justify-between rounded-[10px] border border-border px-4 py-3">
                  <span className="text-sm text-muted-foreground">Theme</span>
                  <ThemeToggle />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
