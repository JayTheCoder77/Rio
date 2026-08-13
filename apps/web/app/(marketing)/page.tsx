import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandingPage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center px-6 py-32 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
        Code review that actually reads the diff.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        Rio reviews your pull requests and local changes with AI that
        understands your codebase, not just the patch.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Button size="lg" render={<Link href="/install" />}>
          Get access
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/docs" />}>
          Read the docs
        </Button>
      </div>
    </section>
  );
}
