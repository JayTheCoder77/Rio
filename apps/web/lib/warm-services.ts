"use client";

const SERVICES = [
  process.env.NEXT_PUBLIC_AI_ENGINE_URL && `${process.env.NEXT_PUBLIC_AI_ENGINE_URL}/v1/health`,
  process.env.NEXT_PUBLIC_SANDBOX_RUNNER_URL && `${process.env.NEXT_PUBLIC_SANDBOX_RUNNER_URL}/v1/health`,
].filter(Boolean) as string[];

let warmedThisSession = false;

export function warmServices() {
  for (const url of SERVICES) {
    void fetch(url, { cache: "no-store", mode: "no-cors", keepalive: true }).catch(() => undefined);
  }
}

export function warmServicesOnce() {
  if (warmedThisSession) return;
  warmedThisSession = true;
  warmServices();
}