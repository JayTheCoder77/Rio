import Link from "next/link";

const FOOTER_COLUMNS = [
  {
    title: "Social",
    links: [
      { href: "https://x.com/JV2077", label: "X / Twitter", external: true },
      { href: "https://github.com/JayTheCoder77/Rio", label: "GitHub", external: true },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="relative overflow-hidden bg-background pt-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <div className="flex flex-col items-start justify-between gap-8 pb-16 sm:flex-row sm:items-end">
          <span className="text-base font-semibold tracking-tight text-foreground">
            RIO
          </span>

          <Link
            href="/install"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Get access
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-10 border-t border-border pb-16 pt-12">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm text-muted-foreground/70">{column.title}</h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="pb-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Rio. All rights reserved.
        </p>
      </div>

      {/* Halftone/dotted giant wordmark, purely decorative */}
      <div aria-hidden className="relative h-[10rem] sm:h-[15rem]">
        <span
          className="pointer-events-none absolute -bottom-[0.22em] left-1/2 -translate-x-1/2 select-none text-[13rem] font-bold leading-none tracking-tight text-foreground sm:text-[19rem]"
          style={{
            backgroundImage:
              "radial-gradient(circle, color-mix(in oklab, var(--foreground) 35%, transparent) 1px, transparent 1.4px)",
            backgroundSize: "6px 6px",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            WebkitTextStroke: "1px color-mix(in oklab, var(--foreground) 10%, transparent)",
          }}
        >
          Rio
        </span>
      </div>
    </footer>
  );
}
