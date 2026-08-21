# Rio — Deployment TODO (free tier, end to end)

Follow these phases **in order**. Each step assumes the previous ones are done.
Nothing here costs money — the only per-user cost is each user's own Groq/OpenRouter
usage, since Rio is BYOK.

---

## Phase 0 — Accounts to create

- [ ] GitHub account (you already have this — used for App/OAuth registration)
- [ ] Neon account (neon.tech) — Postgres
- [ ] Upstash account (upstash.com) — Redis
- [ ] Pinecone account (pinecone.io) — vector index
- [ ] Render account (render.com) — no card required for free tier
- [ ] Vercel account (vercel.com) — for `apps/web`
- [ ] PyPI account (pypi.org) — only needed later, for publishing the CLI
- [ ] Free account with **either** Groq (console.groq.com) or OpenRouter
      (openrouter.ai) — this is *your own test key*, used only to verify the
      pipeline end-to-end in Phase 8. Not required for hosting.

---

## Phase 1 — Provision external services

### 1.1 Neon (Postgres)
- [ ] Create a new Neon project (any region close to where Render will run —
      pick the same region for both to cut latency).
- [ ] Copy the pooled connection string. This is your `DATABASE_URL`.
- [ ] Save it somewhere temporary (password manager / local `.env`, not committed).

### 1.2 Upstash (Redis)
- [ ] Create a new Redis database, **regional** (not global — BullMQ doesn't
      benefit from multi-region and it complicates consistency).
- [ ] Copy the **TLS** connection string (`rediss://...`). This is your `REDIS_URL`.

### 1.3 Pinecone
- [ ] Create a Starter-plan project.
- [ ] Create a serverless index named `rio` (matches the code's default
      `PINECONE_INDEX_NAME`). Set dimension to match whatever embedding model
      `services/ai-engine/app/indexing.py` actually uses — check that file's
      embedding call before creating the index; getting the dimension wrong
      means recreating the index later.
- [ ] Copy the API key. This is `PINECONE_API_KEY`.

### 1.4 Generate shared secrets (do this once, locally)
- [ ] `openssl rand -base64 32` → this is `INTERNAL_SERVICE_TOKEN`. Must be
      **identical** on `apps/worker` and `services/ai-engine` — this is the
      shared secret the worker uses to authenticate to ai-engine.
- [ ] `openssl rand -hex 32` → this is `ENCRYPTION_KEY`. Must be **identical**
      on `services/ai-engine` and `apps/web` — encrypts each user's stored
      Groq/OpenRouter key at rest.

At the end of Phase 1 you should have five values saved locally:
`DATABASE_URL`, `REDIS_URL`, `PINECONE_API_KEY`, `INTERNAL_SERVICE_TOKEN`,
`ENCRYPTION_KEY`.

---

## Phase 2 — Run database migrations against Neon

- [ ] Locally, in the repo root, create a `.env` (not committed) with at least
      `DATABASE_URL=<your Neon string>`.
- [ ] `bun install` at repo root (installs `drizzle-kit` as part of
      `packages/db`'s devDependencies).
- [ ] `cd packages/db && bunx drizzle-kit migrate` — applies all 9 existing
      migrations (`0000` through `0008`) to the fresh Neon database.
- [ ] Verify in the Neon console's table browser that tables like `users`,
      `accounts`, `apiKeys` exist.

Do this **before** deploying any service — every service assumes the schema
already exists on boot.

---

## Phase 3 — Register the GitHub App + OAuth App

You need a URL for the webhook before this step is fully complete, but GitHub
lets you register first and edit the webhook URL later — so do the parts you
can now, and come back after Phase 4 to paste in the real Render URL.

### 3.1 GitHub App (github.com/settings/apps/new)
- [ ] Name it (e.g. `rio-code-review-yourname` — must be globally unique).
- [ ] Homepage URL: your future Vercel URL (placeholder is fine for now, e.g.
      `https://rio.vercel.app`).
- [ ] Webhook URL: placeholder for now (`https://example.com`) — you'll edit
      this after Phase 4.2.
- [ ] Generate and note a **webhook secret** (`WEBHOOK_SECRET`) — anything
      random, doesn't need to match anything else.
- [ ] Permissions: check `apps/github-app/src` for the exact scopes it uses
      (pull requests, checks, contents at minimum for a review bot) and grant
      only those.
- [ ] Subscribe to the webhook events the app actually handles (check
      `apps/github-app/src/index.ts` for the event names it listens to).
- [ ] Create the app, then generate a **private key** (`.pem` file) —
      download it, keep it safe.
- [ ] Note the **App ID** shown on the app's settings page.

### 3.2 GitHub OAuth App (github.com/settings/developers → OAuth Apps)
- [ ] This is separate from the GitHub App above — it's for the "Sign in with
      GitHub" flow on `apps/web` (NextAuth).
- [ ] Homepage URL: your future Vercel URL.
- [ ] Authorization callback URL: `https://<your-vercel-domain>/api/auth/callback/github`
      (placeholder domain for now, fix after Phase 6).
- [ ] Note the **Client ID** and generate a **Client Secret**.

At the end of Phase 3 you have: App ID, the `.pem` private key contents,
webhook secret, OAuth client ID, OAuth client secret.

---

## Phase 4 — Deploy the four Render services

Do these one at a time, in this order, since `worker` and `ai-engine` share
secrets with each other and `github-app` needs Postgres/Redis already live
(which they are, from Phase 1).

For every Render service: **New → Web Service → connect the GitHub repo**,
then set **Root Directory** to the specific app path so Render only rebuilds
that service when its own directory changes.

### 4.1 `services/sandbox-runner` (deploy first — no dependencies)
- [ ] Root Directory: `services/sandbox-runner`
- [ ] Runtime: Docker (it has its own `Dockerfile`, Render auto-detects it)
- [ ] No environment variables needed (it's stateless — takes code, runs
      ruff/mypy/semgrep/eslint/tsc, returns results).
- [ ] Deploy, confirm `/` or its health endpoint responds.
- [ ] Note its URL (e.g. `rio-sandbox-runner.onrender.com`).

### 4.2 `services/ai-engine`
- [ ] Root Directory: `services/ai-engine`
- [ ] Runtime: Python 3 (native, not Docker — matches the `requires-python
      3.12` in `pyproject.toml`)
- [ ] Build Command: `uv sync --frozen` (or `pip install -e .` if you'd rather
      not deal with `uv` on Render — check what's actually available in
      Render's Python environment first)
- [ ] Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- [ ] Environment variables:
  - `DATABASE_URL` = Neon string (Phase 1.1)
  - `PINECONE_API_KEY` = Phase 1.3
  - `PINECONE_INDEX_NAME` = `rio`
  - `INTERNAL_SERVICE_TOKEN` = Phase 1.4 (must match worker's, set in 4.4)
  - `ENCRYPTION_KEY` = Phase 1.4 (must match web's, set in Phase 6)
  - `MAX_DIFF_CHARS` = `20000` (lower than the 40000 default — keeps free-tier
    memory/time usage bounded; the code returns a clean 422 above this, not a
    crash, per the comment in `.env.example`)
  - If `services/sandbox-runner` is called *by* ai-engine, add its URL from
    4.1 as well (check `app/nodes.py` / `app/graph.py` for the exact env var
    name it expects — grep for `SANDBOX` in `services/ai-engine/app`).
- [ ] Deploy, confirm `GET /v1/health` returns `{"status": "ok"}`.
- [ ] Note its URL (e.g. `rio-ai-engine.onrender.com`) — **you'll need this
      exact URL again in Phase 7 for the CLI.**

### 4.3 `apps/github-app`
- [ ] Root Directory: `apps/github-app`
- [ ] Runtime: Docker (uses its existing `Dockerfile`)
- [ ] Environment variables:
  - `APP_ID` = Phase 3.1
  - `PRIVATE_KEY` = contents of the `.pem` file, with real newlines kept as
    literal `\n` (the app converts them at boot — see the comment in its
    `.env.example`)
  - `WEBHOOK_SECRET` = Phase 3.1
  - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` = Phase 3.2
  - `DATABASE_URL` = Neon string
  - `REDIS_URL` = Upstash string (Phase 1.2)
  - `PORT` = `3000` (or whatever Render injects — check its docs on `$PORT`
    vs a fixed port for Docker services)
  - `LOG_LEVEL` = `info`
- [ ] Deploy, confirm the service is up (Probot logs a startup line if the
      app booted and connected correctly — check Render's log tab).
- [ ] Note its URL (e.g. `rio-github-app.onrender.com`).
- [ ] **Go back to Phase 3.1** and update the GitHub App's Webhook URL to
      `https://rio-github-app.onrender.com/api/github/webhooks` (path depends
      on how Probot mounts it — check `apps/github-app/src/index.ts`).

### 4.4 `apps/worker`
This one needs a tiny code change first, since it has no HTTP server and
Render's free tier only covers Web Services.

- [ ] **Before deploying**: add a minimal health-check HTTP server (5-10
      lines, e.g. a bare `http.createServer` on `process.env.PORT` returning
      200 on `/healthz`) that runs alongside the BullMQ consumers in the same
      process, so Render treats it as a Web Service instead of rejecting it.
- [ ] Decide: run `start:review` and `start:index` as two separate Render
      services (cleaner logs, independent restarts) or combine them into one
      start script that runs both. Two services is simpler to reason about —
      recommended unless you're trying to conserve Render service slots.
- [ ] Root Directory: `apps/worker`
- [ ] Build Command: whatever installs deps for a Bun app on Render (check
      Render's Bun support — if it's not native, a Docker wrapper using the
      `oven/bun` base image is the fallback).
- [ ] Start Command: `bun run src/worker.ts` (and a second service with `bun
      run src/indexWorker.ts` if you split them).
- [ ] Environment variables:
  - `APP_ID` / `PRIVATE_KEY` = same as github-app (Phase 3.1)
  - `DATABASE_URL` = Neon string
  - `REDIS_URL` = Upstash string
  - `INTERNAL_SERVICE_TOKEN` = **exact same value** as ai-engine's (Phase 4.2)
- [ ] Deploy, confirm the health endpoint responds and logs show a Redis
      connection established (BullMQ/ioredis logs this on connect).

At the end of Phase 4, all four backend services are live with public
`.onrender.com` URLs.

---

## Phase 5 — Set up keep-alive pinging

Render free services sleep after 15 minutes idle. A cold GitHub webhook
delivery will still work (GitHub retries), just slowly. Reduce this:

- [ ] Sign up at cron-job.org (or UptimeRobot) — free.
- [ ] Add a job pinging `https://rio-github-app.onrender.com/healthz` (or
      whatever health path it exposes) every 10 minutes.
- [ ] Add a second job pinging the worker's health endpoint every 10 minutes.
- [ ] Optional: ping ai-engine's `/v1/health` too if you want the CLI/dashboard
      path to feel snappy as well.

---

## Phase 6 — Deploy `apps/web` to Vercel

- [ ] Vercel → New Project → import the repo.
- [ ] Root Directory: `apps/web`.
- [ ] Framework preset: Next.js (auto-detected).
- [ ] Environment variables — check `apps/web/auth.config.ts` and
      `apps/web/auth.ts` for the exact names NextAuth expects, but at minimum:
  - `DATABASE_URL` = Neon string
  - `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` (or `GITHUB_CLIENT_ID` /
    `GITHUB_CLIENT_SECRET`, depending on what the code reads) = Phase 3.2
  - `ENCRYPTION_KEY` = **exact same value** as ai-engine's (Phase 1.4) — the
    settings page uses this to encrypt the BYOK provider key before it's
    stored.
  - `NEXTAUTH_URL` / `AUTH_URL` (whichever NextAuth v5 config expects) =
    your final Vercel URL.
- [ ] Deploy. Note the real Vercel URL (e.g. `rio-yourname.vercel.app`).
- [ ] **Go back to Phase 3.2** and fix the OAuth App's callback URL and
      homepage to use this real URL instead of the placeholder.
- [ ] **Go back to Phase 3.1** and fix the GitHub App's homepage URL too.
- [ ] Sign in via "Sign in with GitHub" on the deployed site and confirm a row
      appears in Neon's `users` table.

---

## Phase 7 — Point the CLI at production and publish

- [ ] In `apps/cli/rio_cli/config.py`, change the default so it's overridable
      but points at production by default:
  ```python
  import os
  DEFAULT_AI_ENGINE_URL = os.environ.get(
      "RIO_API_URL", "https://rio-ai-engine.onrender.com"
  )
  ```
  (use ai-engine's actual Render URL from Phase 4.2)
- [ ] Bump the version in `apps/cli/pyproject.toml`.
- [ ] `cd apps/cli && uv build` (or `python -m build`) to produce the wheel/sdist.
- [ ] `twine upload dist/*` to publish to PyPI (needs the PyPI account +
      an API token from Phase 0).
- [ ] In a fresh shell/venv: `pip install rio-cli`, then `rio auth` — generate
      a Rio API key from the web dashboard first (Phase 6's deployed site),
      paste it in, confirm `rio auth` validates against `/v1/me` successfully.

---

## Phase 8 — Configure BYOK and run a real end-to-end test

This is the first point anything actually costs the *end user* (you, acting
as a test user) — and it's free if you use Groq's free tier.

- [ ] On the deployed web dashboard, go to Settings → connect a Groq or
      OpenRouter key (from Phase 0), pick a model.
- [ ] **CLI path**: in a local git repo with some staged changes, run
      `rio review --staged`. Confirm it returns real findings (not a 412 — if
      you get a 412, the credential didn't save/decrypt correctly, check
      `ENCRYPTION_KEY` matches between web and ai-engine).
- [ ] **GitHub App path**: install the GitHub App on a real repo you control,
      open a PR with some changes, confirm:
  - the webhook fires (check github-app's Render logs)
  - a job appears in the Upstash queue and gets picked up (check worker's logs)
  - the worker resolves the installation's owning user correctly and calls
    ai-engine with `on_behalf_of_user_id` set
  - a review comment actually posts back to the PR

---

## Phase 9 — Wire up CD

- [ ] On GitHub, add branch protection on `main` requiring the existing
      `.github/workflows/ci.yml` checks (`js` and `python` jobs) to pass
      before merge.
- [ ] On each Render service, confirm **Auto-Deploy** is on for `main` (it's
      on by default when you connect the repo, but double-check).
- [ ] Optional but recommended: commit a `render.yaml` Blueprint at the repo
      root capturing all four services' config from Phase 4, so the whole
      backend can be recreated with `render blueprint deploy` instead of
      manually re-clicking through the dashboard if you ever need to.
- [ ] Vercel's GitHub integration auto-deploys on push to `main` by default —
      confirm this is enabled in the Vercel project settings.
- [ ] Push a trivial change to `main` and confirm all five deployments
      (4 Render + Vercel) trigger and go green.

---

## Done checklist (sanity check before calling this "deployed")

- [ ] Web dashboard reachable, GitHub sign-in works
- [ ] GitHub App installable on a repo, webhook delivers successfully
- [ ] A PR triggers a posted review comment end to end
- [ ] `pip install rio-cli` + `rio auth` + `rio review --staged` works from a
      clean environment with no local config
- [ ] BYOK settings page stores and later successfully decrypts a provider key
- [ ] All five services auto-redeploy on push to `main`
- [ ] Keep-alive pings are running so cold starts aren't the first thing a
      demo viewer hits