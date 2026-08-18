import Link from "next/link";

import { signIn } from "@/auth";
import { SignInButton } from "./sign-in-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex w-full max-w-[400px] flex-col items-center text-center">
      <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
        RIO
      </Link>

      <h1 className="mt-8 text-3xl font-light tracking-tight text-foreground/90">
        Sign in to Rio
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Continue with your GitHub account to get started.
      </p>

      <form
        className="mt-8 w-full"
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: callbackUrl ?? "/dashboard" });
        }}
      >
        <SignInButton />
      </form>

      <p className="mt-6 text-xs text-muted-foreground">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}