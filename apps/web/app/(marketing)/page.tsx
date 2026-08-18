import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { VideoPlaceholder } from "@/components/marketing/video-placeholder";

const AVAILABLE_NOW = [
  {
    title: "Dashboard with analytics",
    desc: "Track reviews, findings, and connected repos.",
  },
  {
    title: "API keys for CLI",
    desc: "Authenticate the Rio CLI against your account.",
  },
];

const COMING_SOON = [
  { title: "Slack", desc: "Push review summaries to your team channel." },
  { title: "Discord", desc: "Review notifications in your server." },
  { title: "Improved context", desc: "Richer understanding of your whole codebase." },
  { title: "Memory", desc: "Rio remembers past reviews and decisions." },
  { title: "Tools (MCP)", desc: "Give Rio tools to read, test, and fix code." },
];

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <Reveal>
        <WaysToReviewSection />
      </Reveal>
      <Reveal>
        <FeatureSection />
      </Reveal>
    </>
  );
}

function HeroSection() {
  return (
    <section className="px-6 pb-24 pt-8 sm:px-10 sm:pb-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-8">
        {/* Left: pill link, thin huge headline, subtext, Log in CTA */}
        <div className="flex flex-col items-start text-left">
          <Link
            href="/docs"
            className="group fade-in-up inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            Read &quot;Rio: reviews that understand your codebase&quot;
            <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1
            className="fade-in-up mt-10 text-5xl leading-[1.05] font-light tracking-tight text-foreground/90 sm:text-6xl lg:text-[4rem]"
            style={{ animationDelay: "80ms" }}
          >
            The code review
            <br />
            platform for
            <br />
            shipping-fast teams
          </h1>

          <p
            className="fade-in-up mt-6 max-w-md text-base text-muted-foreground"
            style={{ animationDelay: "160ms" }}
          >
            Bring Rio into your pull requests. No walled review queues.
          </p>

          <div className="fade-in-up mt-8" style={{ animationDelay: "240ms" }}>
            <Button size="lg" render={<Link href="/login" />}>
              Log in
            </Button>
          </div>
        </div>

        {/* Right: product demo video placeholder */}
        <VideoPlaceholder label="Hero video placeholder" />
      </div>
    </section>
  );
}

function WaysToReviewSection() {
  const options = [
    {
      title: "Want GitHub?",
      sub: "Use the app",
      label: "GitHub App demo placeholder",
      href: "/install",
    },
    {
      title: "Want local?",
      sub: "Use the CLI",
      label: "CLI demo placeholder",
      href: "/install",
    },
  ];

  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-4xl font-light tracking-tight text-foreground/90 sm:text-5xl">
          Ways to review.
        </h2>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {options.map((o) => (
            <Link
              key={o.title}
              href={o.href}
              className="group flex flex-col gap-4 rounded-[24px] border border-border bg-card p-6 transition-colors hover:border-foreground/15"
            >
              <div>
                <h3 className="text-xl font-medium tracking-tight text-foreground">
                  {o.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{o.sub}</p>
              </div>
              <VideoPlaceholder label={o.label} />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureSection() {
  return (
    <section className="px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-4xl font-light tracking-tight text-foreground/90 sm:text-5xl">
          Features
        </h2>

        <div className="mt-12 flex flex-col gap-3">
          {AVAILABLE_NOW.map((f) => (
            <div
              key={f.title}
              className="flex items-center justify-between rounded-[20px] border border-border bg-card px-6 py-4"
            >
              <span className="text-sm font-medium text-foreground">
                {f.title}
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Live
              </span>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {COMING_SOON.map((f) => (
            <div
              key={f.title}
              className="rounded-[20px] border border-border bg-card p-6"
            >
              <h3 className="text-base font-medium tracking-tight text-foreground">
                {f.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              <span className="mt-4 inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Coming soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}