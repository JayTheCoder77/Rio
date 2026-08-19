# Rio — TODO

## BYOK (LLM provider key) — Groq / OpenRouter

**Decision log:**
- Chat/review LLM: user brings their own key from **Groq** or **OpenRouter** (both OpenAI-compatible
  APIs — one `ChatOpenAI(base_url=..., api_key=...)` client covers both, no separate SDKs needed).
- Embeddings: **stay self-hosted** (Ollama `nomic-embed-text`, unchanged). Not BYOK.
  - Groq has no embeddings API at all (confirmed via their own community forum, no roadmap commitment).
  - OpenRouter does have `/api/v1/embeddings`, but splitting embeddings across providers per-user
    risks breaking Pinecone's fixed `dimension=768` index (`nomic-embed-text`'s output size) —
    switching would require a new index or a full re-index. Not worth it for something that's cheap
    and already working (Day 9).
  - The actual risk this whole feature is mitigating ("don't let strangers run inference on your API
    key," per the Day 15 plan) is about the *chat LLM* cost, not local embeddings — so scoping BYOK to
    just the LLM directly addresses the real problem.
- Provider key storage: **Option 1 — server-side, per Rio account.** One key entered once via the web
  dashboard, encrypted at rest, used by both the GitHub App worker and the CLI (via the existing Rio
  API key → user id lookup). Not a second local secret the CLI has to separately manage.
  - Billing/usage tracking across the shared key: **deferred, post-MVP** (per explicit decision).

### Implementation tasks

- [x] **DB migration**: extended `users` with 3 nullable columns — `model_provider` (new pgEnum
      `"groq" | "openrouter"`), `model_name`, `model_api_key_encrypted`. Not a new table — a strict
      1:1 fact about a user, matching the `accounts.access_token` pattern already in the schema.
      Applied to the real Neon dev DB, verified via `information_schema.columns`.
- [x] **Encryption helper**: `apps/web/lib/model-credentials.ts` (Node `crypto`, AES-256-GCM) +
      `services/ai-engine/app/crypto.py` (Python `cryptography` lib's `AESGCM`). Same wire format:
      `base64(iv[12] || ciphertext || authTag[16])`, keyed by `ENCRYPTION_KEY` env var (32 bytes,
      base64-encoded). Verified byte-compatible in both directions (TS encrypt → Python decrypt, and
      reverse) via temporary cross-language round-trip tests.
- [x] **`ai-engine` factory refactor**: `nodes.py` — removed the module-level `ChatOllama` singleton,
      added `build_llm(credential) -> ChatOpenAI` using a `PROVIDER_BASE_URLS` dict (one `ChatOpenAI`
      class covers both Groq and OpenRouter, since both are OpenAI-compatible — only `base_url` differs).
      `review()` node builds the LLM fresh per-invocation from `state.llm_credential`, raises a clear
      `ValueError` if absent (second line of defense). Embeddings (`OllamaEmbeddings`) untouched —
      still self-hosted, per the earlier decision.
- [x] **Fail closed**: `/v1/review` returns `412 Precondition Failed` with a clear message if the
      caller's account has no provider credential configured — no shared/self-hosted fallback.
      Verified live: created a temp API key for a real user with no credential, confirmed the exact
      412 response.
- [x] **`ai-engine/app/auth.py`**: added `get_user_llm_credential(user_id)` — raw `psycopg` query
      against the new `users` columns, decrypts via `app.crypto.decrypt_provider_key`, returns `None`
      on any failure (missing row, unconfigured, decrypt failure). Added `require_current_user` (401 on
      invalid/missing key, unlike the existing `get_current_user` which degrades to anonymous) — used by
      both `/v1/me` and now `/v1/review`.
  - Verified end-to-end short of a real billed LLM call: encrypted a fake test provider key, wrote it
    to a real user's row, confirmed `get_user_llm_credential` decrypts correctly and `build_llm`
    produces a `ChatOpenAI` client with the correct `base_url`/model for Groq. Reverted the test row
    afterward — no leftover state.
- [x] **Worker** (`apps/worker/src/worker.ts`): resolves which Rio user's credential powers a GitHub
      App review via `getInstallationOwnerId` (new query in `packages/db/src/queries.ts`) — the
      **earliest-linked user** for that installation, since `userInstallations` is many-to-many and
      there's no explicit "owner" concept.
  - **Known tradeoff, accepted deliberately**: if that first-linked user's credential is
    missing/revoked, reviews fail closed for the *whole* installation, even if another linked
    teammate has a valid key configured. Fine for the common solo-install case; a real limitation for
    multi-user teams sharing one installation. Revisit only if/when that becomes an actual complaint —
    fixing it properly means either explicit installation-owner semantics or moving the credential to
    `installations` (contradicts the earlier "keep it on `users`" simplicity decision), not something
    to guess at now.
  - Required a **second, distinct trust boundary** in `ai-engine` (`app.auth.verify_internal_service_token`,
    keyed by a new `INTERNAL_SERVICE_TOKEN` env var, shared secret between worker and ai-engine only)
    since the worker has no per-user Rio API key to authenticate as — it instead asserts
    "run this review as this already-resolved user" via `ReviewState.on_behalf_of_user_id`.
    `review_endpoint` requires **both** a valid internal token **and** an explicit user id together —
    the token alone cannot impersonate anyone (verified via 4 real HTTP scenarios: valid token + user
    id → reaches the credential check; valid token without a user id → 401; forged/wrong token even
    with a user id → 401; no auth at all → 401).
  - Verified `getInstallationOwnerId` against real production-shape data (a real linked installation),
    and correctly returns `null` for a nonexistent installation.
- [x] **Web dashboard**: new settings section on `apps/web/app/dashboard/settings/page.tsx` (between
      Profile and Account) — shows a connect form (provider dropdown, model dropdown scoped to the
      selected provider, API key input) if no credential is configured, otherwise shows
      provider + model + masked last-4-chars with a disconnect button. Added `users.modelApiKeyLastFour`
      column (can't recover last-4 from the encrypted blob after the fact, mirrors `apiKeys.lastFour`).
      `next.config.ts`'s env loader generalized to also pull `ENCRYPTION_KEY` from the root `.env`
      (shared secret with `ai-engine`, single source of truth). Verified: real round-trip against the
      live DB using the actual TS query functions, and — critically — a credential encrypted via the
      actual dashboard code path (`encryptProviderKey`) was successfully decrypted by the actual
      `ai-engine` code path (`get_user_llm_credential`), confirming the real cross-service integration
      works, not just the isolated crypto test from earlier.
- [x] **CLI**: no local provider-key config needed — confirmed via task 5's implementation.
- [ ] **Task 8 (blocked)**: full live end-to-end test with a real Groq or OpenRouter API key —
      configure via the dashboard, run `rio review --staged` against a local diff, confirm the review
      actually calls out to Groq/OpenRouter (not Ollama) and returns real findings. Then repeat through
      the GitHub App path (real PR, confirm the worker/ai-engine path uses the installation owner's
      stored key). **Blocked on the user providing a real provider API key** — everything short of the
      actual billed LLM call has been verified (credential storage, encryption, decryption, fail-closed
      behavior, both trust boundaries, `ChatOpenAI` client construction with correct `base_url`/model).

## `rio auth` CLI command

- [x] New `apps/cli/rio_cli/auth.py`: `rio auth` typer command.
  - Prompts for the Rio API key (`typer.prompt(..., hide_input=True)`), created beforehand via the web
    dashboard (`dashboard/api-keys`, already built).
  - Validates immediately against a new `GET /v1/me` endpoint on `ai-engine` (added
    `require_current_user` — a strict variant of `get_current_user` that raises `401` on invalid/missing
    key instead of degrading to anonymous) — so a bad paste fails at `rio auth` time, not at
    `rio review` time. No config file is written on a failed attempt (verified).
  - Writes to `~/.config/rio/config.toml` under `[api] api_key`, creating the `~/.config/rio/` dir if
    missing.
  - **File permissions**: `os.chmod(CONFIG_PATH, 0o600)` after writing — verified via `ls -la` showing
    `-rw-------`.
- [x] Confirmed purely client-side: `Path.home()` resolves per-user, per-machine — nothing about
      `rio auth` touches deployed infra. Each user who runs `pip install rio-cli && rio auth` gets their
      own local config file.
- [x] Registered `auth` command in `apps/cli/rio_cli/main.py` alongside `review`.
- [x] Updated `apps/cli/README.md` — replaced manual config.toml instructions with `rio auth` usage.
- [x] Bumped `rio-cli` to `0.2.0`, built (`uv build --package rio-cli --no-sources`) — ready to publish.
  - End-to-end verified before publishing: started local `ai-engine` against the real dev Neon DB,
    confirmed `/v1/me` returns `401` for missing/invalid keys (both via direct `curl` and via
    `rio auth`'s own error message), inserted a temporary real API key row, ran `rio auth` successfully
    end-to-end (validated, saved, `0600` perms confirmed), then deleted the temporary test key row and
    the local test config file. No leftover test artifacts.

## Day 15 — Hardening & deploy (paused mid-session, resume after BYOK)

Original scope from `CONTEXT.md` Phase 11:

- [ ] Structured logging + correlation ID threaded webhook → job → ai-engine call (no logging lib
      currently installed anywhere except stray `logging` use in `ai-engine/app/auth.py`; worker/
      github-app use ad-hoc `console.log`/`console.error`).
- [ ] Concurrency limits so one repo's PR burst can't starve others (BullMQ `pr-review`/`index-repo`
      queues currently have no `concurrency`/rate-limit config at all).
- [ ] Secrets audit — mostly already satisfied (`.env`/`*.pem` gitignored, confirmed), but re-check
      once `ENCRYPTION_KEY` and provider-key encryption (from BYOK work above) are added.
- [ ] External-call failure paths degrade gracefully — currently `ai-engine/app/nodes.py` (Ollama LLM
      calls, Pinecone calls in `enrich`) and `indexing.py` (Ollama embed, Pinecone upsert) have no
      try/except; an Ollama timeout or Pinecone error 500s with an unhandled exception instead of a
      clear message. `sandbox-runner/app/orchestrator.py` docker calls also unguarded beyond the
      existing `DOCKER_TIMEOUT_S` kill-on-timeout.
- [ ] Dockerfiles missing for `ai-engine` and `worker` (only `github-app` and `sandbox-runner` have
      one currently). `apps/web` deploys to Vercel, no Dockerfile needed — just confirm build works.
- [ ] Document deploy targets: ai-engine + sandbox-runner + worker → Cloud Run/Fly/Railway; web →
      Vercel; Postgres already on Neon; Redis → Upstash (managed). Actual deploy execution needs the
      user's cloud provider accounts/credentials — cannot be done by the agent alone.
- [ ] Point GitHub App's real webhook URL at deployed endpoint, turn off smee/ngrok (final step, after
      everything above is live).

## Already shipped this session

- [x] Published `rio-review-core` (renamed from `rio-core` — PyPI rejected `rio-core` as confusably
      similar to the existing `riocore` package) — live on PyPI, v0.1.0.
- [x] Published `rio-cli` — live on PyPI, v0.1.0 initially, then v0.2.0 (added `rio auth`). Installs
      the `rio` command, depends on `rio-review-core>=0.1.0,<0.2.0`. Verified end-to-end: clean Python
      3.12 venv, `pip install rio-cli` correctly pulls `rio-review-core` transitively, `rio --help` and
      `rio_core` imports both work.
- [x] Full BYOK implementation (7/8 sub-tasks, see above) — server-side encrypted Groq/OpenRouter
      credential storage, per-request `ai-engine` LLM factory, fail-closed auth on both the CLI and
      GitHub App paths, dashboard settings UI. Only blocked item: a full live LLM call with a real
      provider key (task 8).
- [x] Removed the model-name allowlist from the dashboard form — provider stays restricted to
      Groq/OpenRouter (deliberate), but the model field is free text now, not a fixed dropdown. Users
      can specify any model id their provider account can call.
- [x] **Provider API error handling**: previously, a bad model name or an invalid/revoked provider key
      would surface as an opaque `500` (CLI) or a misleading "will retry automatically" PR comment
      (GitHub App) — the LLM call itself had no error handling at all. Added `ProviderCredentialError`
      in `nodes.py`, catching `openai.APIStatusError` (400/401/403/404/429 from Groq/OpenRouter) and
      `openai.APIConnectionError` (network issues) around the `structured_llm.invoke()` call in
      `review()`, translating each into a specific, actionable message (e.g. "Groq could not find the
      model 'foo' — check the model name in your Rio dashboard settings"). `main.py` catches this and
      returns `422` (distinct from `412` "no credential configured at all"). CLI (`post.py`) and worker
      (`worker.ts`) both surface the exact message — the worker's PR failure comment now says *why* it
      failed instead of "will retry automatically" when the failure is a known non-retryable one (new
      `NonRetryableReviewError` class in `worker.ts`, since retrying with the same bad model name would
      just fail identically every time).
  - Verified against the **real live Groq API**: a genuinely invalid key produces a real `401` from
    Groq (confirmed via direct `curl` against `api.groq.com`), which the full pipeline correctly turns
    into a `422` with the exact expected message — tested through the real `ai-engine` HTTP endpoint
    and the real `rio review` CLI command. The 404 (bad model name) branch's message logic was verified
    directly (constructing a matching `APIStatusError` shape) since isolating "valid key + bad model"
    from "invalid key" isn't possible without a real valid key to test with.
  - **OpenRouter-specific follow-up**: confirmed via OpenRouter's own docs and a live `401` test against
    `api.openrouter.ai` that pre-stream errors (bad key, bad model — the case originally asked about)
    behave identically to Groq's (real HTTP status codes, already covered by the `APIStatusError` catch
    above). But OpenRouter has a second failure mode docs call out explicitly: a **mid-generation**
    upstream provider failure (the model/key are valid, but the specific backend serving that model
    disconnects/crashes) can return an HTTP `200` with the error embedded in `choices[0].error` instead
    of raising an HTTP error at all — invisible to `APIStatusError`. Traced this precisely using
    `httpx.MockTransport` to simulate OpenRouter's exact documented response shape through the real
    `openai` SDK and `langchain_openai.ChatOpenAI`: the SDK silently drops the embedded `error` dict but
    preserves `finish_reason: "error"` in `response_metadata`; `.with_structured_output()` (the actual
    method `review()` calls) then fails with a generic, unhelpful `ValueError` ("does not have a
    'parsed' field..."). Added a narrow catch in `review()` that detects this specific shape (checking
    for the `finish_reason` marker in the exception's message, since `langchain_openai` doesn't expose
    it more directly) and translates it into a clear `ProviderCredentialError` — "the upstream model
    provider... failed mid-generation... usually transient, try again." Verified both that the real
    shape is correctly caught (via a temp test calling the actual `review()` function with a mocked
    OpenRouter response matching their documented format) and that an unrelated `ValueError` from
    elsewhere in the invoke chain still propagates normally (not accidentally swallowed by the narrow
    check). No changes needed in `main.py`/CLI/worker — they already handle `ProviderCredentialError`
    generically from the earlier fix.
