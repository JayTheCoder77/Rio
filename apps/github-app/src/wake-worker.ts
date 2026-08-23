// apps/github-app/src/wake-worker.ts
// Fired right after enqueueing a job — workers only wake on an HTTP
// request (Render has no visibility into internal Redis polling), so
// without this, a job can sit in the queue indefinitely if the worker
// happened to be asleep.
//
// ai-engine and sandbox-runner are woken in the same call, not waited on
// separately by the worker later — otherwise cold starts stack (worker
// wakes, THEN calls ai-engine, THEN ai-engine wakes), which can double
// the wait. Firing all three at once lets them cold-start in parallel.
const WORKER_URLS: Record<"review" | "index", string | undefined> = {
  review: process.env.REVIEW_WORKER_URL,
  index: process.env.INDEX_WORKER_URL,
};

const AUX_URLS: (string | undefined)[] = [
  process.env.AI_ENGINE_URL && `${process.env.AI_ENGINE_URL.replace(/\/$/, "")}/v1/health`,
  process.env.SANDBOX_RUNNER_URL && `${process.env.SANDBOX_RUNNER_URL.replace(/\/$/, "")}/v1/health`,
];

// A fully-cold Render free-tier container can take well past a few seconds
// to spin up — this ping is fire-and-forget and doesn't block enqueueing,
// so there's no cost to giving it real room. A single short-timeout attempt
// (previously 5s) can get aborted mid-cold-start before the container ever
// finishes booting, which looks identical to "the ping never happened" —
// exactly what caused jobs to sit in `waiting` with no automatic recovery.
async function ping(url: string, attempts = 3, timeoutMs = 45000) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return;
    } catch {
      // fall through to retry
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 5000));
  }
}

export function wakeWorker(kind: "review" | "index") {
  const url = WORKER_URLS[kind];
  if (url) void ping(`${url.replace(/\/$/, "")}/healthz`);
  for (const auxUrl of AUX_URLS) {
    if (auxUrl) void ping(auxUrl);
  }
}