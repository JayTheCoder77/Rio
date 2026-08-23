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

function ping(url: string) {
  void fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => undefined);
}

export function wakeWorker(kind: "review" | "index") {
  const url = WORKER_URLS[kind];
  if (url) ping(`${url.replace(/\/$/, "")}/healthz`);
  for (const auxUrl of AUX_URLS) {
    if (auxUrl) ping(auxUrl);
  }
}