import Link from "next/link";
import { Code2, MessageCircle } from "lucide-react";

import { Separator } from "@/components/ui/separator";

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/install", label: "Install" },
      { href: "/docs", label: "Docs" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/careers", label: "Careers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

const SOCIAL_LINKS = [
  { href: "https://github.com", label: "GitHub", icon: Code2 },
  { href: "https://twitter.com", label: "Twitter", icon: MessageCircle },
];

export function MarketingFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border/50">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Rio
            </Link>
            <p className="mt-3 max-w-[220px] text-sm text-muted-foreground">
              AI-powered code review for your CLI and pull requests.
            </p>
            <div className="mt-4 flex items-center gap-3">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.href}
                  href={social.href}
                  aria-label={social.label}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <social.icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-medium">{column.title}</h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-10" />

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Rio. All rights reserved.
        </p>
      </div>

      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-[0.3em] left-1/2 -translate-x-1/2 select-none text-[13rem] font-bold leading-none tracking-tight text-foreground/[0.03] sm:text-[18rem]"
      >
        Rio
      </span>
    </footer>
  );
}
