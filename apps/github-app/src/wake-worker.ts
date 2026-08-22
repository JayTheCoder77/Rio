// apps/github-app/src/wake-worker.ts
// Fired right after enqueueing a job — workers only wake on an HTTP
// request (Render has no visibility into internal Redis polling), so
// without this, a job can sit in the queue indefinitely if the worker
// happened to be asleep.
const WORKER_URLS: Record<"review" | "index", string | undefined> = {
    review: process.env.REVIEW_WORKER_URL,
    index: process.env.INDEX_WORKER_URL,
  };
  
  export function wakeWorker(kind: "review" | "index") {
    const url = WORKER_URLS[kind];
    if (!url) return;
    void fetch(`${url.replace(/\/$/, "")}/healthz`, { signal: AbortSignal.timeout(5000) }).catch(
      () => undefined,
    );
  }