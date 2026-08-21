// apps/worker/src/serve.ts
// Render free tier only supports Web Services, not Background Workers — this
// gives Render something to health-check while the real BullMQ consumer runs
// underneath. WORKER_ENTRY picks review vs index; set it per Render service
// so both consumers deploy from this one image.
Bun.serve({
    port: Number(process.env.PORT ?? 3000),
    fetch(req) {
      return new URL(req.url).pathname === "/healthz"
        ? new Response("ok")
        : new Response("not found", { status: 404 });
    },
  });
  
  await import(process.env.WORKER_ENTRY === "index" ? "./indexWorker" : "./worker");

export { };
