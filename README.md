# Rio

![CI](https://github.com/JayTheCoder77/Rio/actions/workflows/ci.yml/badge.svg)
![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)

**Rio** is an AI-powered code review platform — a CodeRabbit-style bot for your pull
requests, plus a matching CLI for reviewing local diffs. It posts inline review
comments, a summary, and an optional pass/fail check, backed by a LangGraph review
engine and a lint/SAST sandbox.

Rio is **BYOK** (bring your own key): each user connects their own Groq or
OpenRouter key in the dashboard, so there is no shared bill for LLM usage.

> Solo-built, end-to-end MVP. Real production architecture (FastAPI + LangGraph,
> Dockerized sandbox, Postgres, Redis queue, Next.js dashboard) — not a toy demo.

---

Note For Me - hit health endpoints of web services and workers in case the app/cli doesnt work

## Features

- **GitHub App** — installs on a repo, reviews every opened/updated PR automatically
with inline comments, a summary, and an optional `Rio` check run
(`require_check` in `.rio.yml`).
- **CLI** — `rio review` reviews local `git diff`s from the terminal, backed by the
same AI engine as the GitHub App. No GitHub round-trip required.
- **LangGraph review pipeline** — `ingest → enrich → review → verify`. Structured
findings (severity, file, line, rationale), cross-checked against sandbox lint/SAST
output and repo-vector context.
- **Sandbox runner** — language linters + SAST (ruff, mypy, semgrep, …) shipped as a
container, invoked by the worker to corroborate LLM findings.
- **Vector context** — repo code + past PR comments indexed into Pinecone on install;
retrieved during the `enrich` step.
- **Per-repo config** — a `.rio.yml` at repo root controls checks and rules.

---



## Architecture

```
Developer ──► { GitHub App · CLI · Website }
                  │
                  ▼
            Redis / BullMQ queue  ──► Worker (review) ──► clone + lint + call AI engine
                  │                                      └─► Worker (index) ──► Pinecone
                  ▼
        AI Engine (FastAPI + LangGraph)
            ingest → enrich → review → verify
                  │
       ┌──────────┼───────────────┐
   Sandbox      Postgres       LLM Provider (Groq / OpenRouter, BYOK)
   Runner       (reviews,        via user-supplied key
   (lint/SAST)  findings, …)
```



### Components


| Component                 | Stack                                          | Role                                                                                                                                       |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/github-app`         | Probot (Bun/TS)                                | Verifies webhooks, enqueues PR review jobs, posts results via Octokit.                                                                     |
| `apps/worker`             | Bun/TS + BullMQ (Redis)                        | Drains the queue: clones the repo, runs the sandbox, calls `ai-engine`, posts the review. Deployed as two services — `review` and `index`. |
| `services/ai-engine`      | FastAPI + LangGraph (Python/uv)RAG - Pinecone | The review brain. Runs the `ingest → enrich → review → verify` graph; also hosts an MCP server and the `/v1/index/repo` endpoint.          |
| `services/sandbox-runner` | Python/uv + Docker                             | One-shot container running language linters + SAST, returns JSON findings.                                                                 |
| `apps/cli`                | Typer + Rich (Python/uv)                       | `rio review` / `rio auth` — local and PR-mode reviews from the terminal.                                                                   |
| `apps/web`                | Next.js                                        | Dashboard: GitHub OAuth sign-in, BYOK settings, analytics.                                                                                 |
| `packages/db`             | Drizzle - Neon (PostgreSQL)                    | Postgres schema + migrations (Neon).                                                                                                       |
| `packages/rio-core`       | Pydantic (Python)                              | Shared diff-parsing + review contract used by `ai-engine` and `cli`.                                                                       |
| `packages/shared-types`   | TS                                             | The `PrReviewJob` BullMQ payload contract.                                                                                                 |




### Review pipeline (`services/ai-engine`)


| Node     | Does                                                                              |
| -------- | --------------------------------------------------------------------------------- |
| `ingest` | Parses the diff, loads `.rio.yml`, enforces the `MAX_DIFF_CHARS` cost cap.        |
| `enrich` | Retrieves relevant chunks from Pinecone + one MCP tool call for context.          |
| `review` | LLM produces structured findings via JSON schema.                                 |
| `verify` | Cross-checks findings against sandbox lint/SAST output; drops unsupported claims. |


---



## Repository layout

This is a monorepo with **two parallel workspace managers that only talk over HTTP**:

- **Bun workspaces** (TypeScript): `apps/web`, `apps/github-app`, `apps/worker`,
`packages/db`, `packages/shared-types`, `packages/ui`, `packages/config`
- **uv workspace** (Python): `services/ai-engine`, `services/sandbox-runner`,
`apps/cli`, `packages/rio-core`

```
rio/
├─ apps/
│  ├─ web/            # Next.js dashboard
│  ├─ github-app/     # Probot webhook receiver + queue producer
│  ├─ worker/          # BullMQ consumer (review + index workers)
│  └─ cli/             # rio-cli (PyPI)
├─ services/
│  ├─ ai-engine/       # FastAPI + LangGraph review engine
│  └─ sandbox-runner/  # lint/SAST container
├─ packages/
│  ├─ db/              # Drizzle schema + migrations
│  ├─ rio-core/         # shared pydantic review contract
│  ├─ shared-types/     # PrReviewJob contract (TS)
│  ├─ ui/               # shared React components
│  └─ config/           # eslint/tsconfig presets
├─ docker-compose.yml  # local Postgres + Redis
├─ turbo.json
├─ package.json         # Bun workspaces + turbo scripts
├─ pyproject.toml        # uv workspace members
└─ .github/workflows/ci.yml
```

---



## How it works

**PR-triggered review**

1. A developer opens/updates a PR → GitHub delivers a webhook to `github-app`.
2. `github-app` verifies the signature and enqueues a `pr-review` job (producer-side
  dedup via a `repo-pr-sha` job id) → returns 200 immediately.
3. The review worker clones the repo, calls the sandbox runner for lint/SAST, then
  calls `ai-engine /v1/review` with the diff, config, lint results, and the owning
   user's id (for BYOK credential resolution).
4. LangGraph runs `ingest → enrich → review → verify`.
5. The worker posts inline comments + (optional) `Rio` check run via Octokit, and
  persists the review/findings to Postgres.

**CLI local review**

1. `rio review --staged` reads the local `git diff`.
2. The CLI authenticates with the user's API key and calls `ai-engine /v1/review`
  directly — no GitHub round-trip, no clone.
3. The same review runs, minus GitHub-specific context; findings render in the
  terminal via Rich.

---



## Tech stack

- **TypeScript half**: Bun workspaces, Turborepo, Probot, Octokit, BullMQ, Drizzle, Next.js.
- **Python half**: uv workspace, FastAPI, LangGraph, LangChain, Pydantic, Typer, Rich.
- **Data**: Postgres (Neon), Redis (Upstash, BullMQ), Pinecone (embeddings).
- **Infra**: Render (backend services), Vercel (web), Docker for everything.

---



## Getting started (local dev)

Prerequisites: `bun`, `uv`, Docker, and a running Postgres + Redis
(`docker compose up -d`).

```sh
# Install JS/TS + Python deps
bun install
uv sync

# Type-check / lint across the workspace
bun run check-types
bun run lint

# Python lint
ruff check .
```

Copy `.env.example` to `.env` at the repo root and fill in `DATABASE_URL`,
`REDIS_URL`, and the GitHub App / provider credentials as needed. See
`dep-todo.md` for the full provisioning + deployment walkthrough (Neon, Upstash,
Pinecone, Render, Vercel).

Refer render.yaml for env vars

### CLI - Pip / UV

```sh
pip install rio-cli
rio auth          # paste a Rio API key from the dashboard
rio review --staged
```

---



## Status

End-to-end deployed MVP: GitHub App, review + index workers, AI engine, sandbox
runner, web dashboard, and CLI are all live. See `dep-todo.md` for the deployment
checklist and `CONTEXT.md` for the detailed build log and design rationale.

**Post-MVP roadmap:** AI-Engine heavy refactor , Slack/Discord + GitLab/Bitbucket clients, IDE extensions, a PR-thread chat agent, docstring/test "finishing touches", multi-provider model routing, more MCP tools, and exposing Rio itself as an MCP server.

---



## License

[ISC](LICENSE) © 2026 JayTheCoder77
