import fnmatch
import logging
import os

from langchain_ollama import OllamaEmbeddings
from langchain_openai import ChatOpenAI
from openai import APIConnectionError, APIStatusError
from pydantic import BaseModel
from rio_core.config import SEVERITY_RANK
from rio_core.diff import parse_diff
from rio_core.models import Finding, RetrievedChunk

from app.indexing import get_embeddings, get_index
from app.state import LlmCredential, ReviewState
from app.utils.utils import format_context

logger = logging.getLogger(__name__)

# Rough token-cost guardrail. Tune per deployment via the MAX_DIFF_CHARS env
# var (set lower in prod if you want stricter caps) rather than editing code.
MAX_DIFF_CHARS = int(os.getenv("MAX_DIFF_CHARS", "40000"))
MAX_CONTEXT_CHARS = 5000
embeddings = OllamaEmbeddings(model="nomic-embed-text")

PROVIDER_BASE_URLS = {
    "groq": "https://api.groq.com/openai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
}

PROVIDER_DISPLAY_NAMES = {
    "groq": "Groq",
    "openrouter": "OpenRouter",
}


class ProviderCredentialError(RuntimeError):
    """Raised when the caller's BYOK provider (Groq/OpenRouter) rejects the
    request — bad model name, revoked/invalid key, rate limit, etc. Distinct
    from a generic crash: `main.py` catches this and returns a clear 4xx
    instead of an opaque 500, so the CLI and the GitHub App failure comment
    can both show the user something actionable."""


class DiffTooLargeError(RuntimeError):
    """Raised when the diff exceeds MAX_DIFF_CHARS. `main.py` catches this and
    returns a 422 so callers get a clear, actionable message instead of a raw
    500 from an unhandled ValueError."""


def ingest(state: ReviewState) -> dict:
    if len(state.diff) > MAX_DIFF_CHARS:
        raise DiffTooLargeError(
            f"diff too large ({len(state.diff)} chars) — cap is {MAX_DIFF_CHARS}. "
            "Review a smaller scope (e.g. `rio review --staged`), or raise the "
            "ai-engine's MAX_DIFF_CHARS env var for your deployment."
        )
    
    parsed_files = parse_diff(state.diff)
    filtered_files = [
        pf for pf in parsed_files
        if not any (fnmatch.fnmatch(pf.path , pattern) for pattern in state.config.ignore_paths)
   ]
    return {"parsed_files" : filtered_files}

class FindingsResponse(BaseModel):
    findings: list[Finding]

def build_llm(credential: LlmCredential) -> ChatOpenAI:
    """Builds a fresh, per-request LLM client from the caller's BYOK
    provider credential. Both Groq and OpenRouter expose OpenAI-compatible
    chat endpoints, so one `ChatOpenAI` class covers both — only the
    base_url, api_key, and model name differ per provider. No client is ever
    cached or shared across requests/users."""
    return ChatOpenAI(
        base_url=PROVIDER_BASE_URLS[credential.provider],
        api_key=credential.api_key,
        model=credential.model,
        temperature=0,
    )

REVIEW_SYSTEM_PROMPT = """You are Rio, an automated code reviewer. You are given a unified diff \
of a pull request and must find real, actionable issues introduced by the changes.

Only comment on lines that are added or modified in this diff — never on unchanged \
context lines, and never invent a file or line number that isn't present in the diff. \
Use the line number from the new (target) version of the file, as shown in the diff's \
hunk headers (the `+` side of `@@ -a,b +c,d @@`).

You may also be given retrieved context from elsewhere in the repository, clearly \
labeled as such. Use it only to inform your understanding of the diff — never cite a  \
file or line number from the retrieved context, and never report issues that exist \
only in the retrieved context and not in the diff itself.

For each issue, assign a severity:
- "critical": bugs, security vulnerabilities, data loss, or correctness errors that \
will cause incorrect behavior in production.
- "warning": design or maintainability problems that aren't outright bugs — poor \
error handling, missing edge cases, unclear naming, code likely to cause a bug later.
- "info": minor style or clarity suggestions worth mentioning but not blocking.

Be selective. A diff with no real issues should return an empty findings list — do not \
invent minor nitpicks just to have something to say. Prioritize signal over volume; a \
reviewer who comments on everything is as useless as one who comments on nothing.

For each finding, give:
- file: the file path as it appears in the diff
- line: the target-file line number
- severity: one of "critical", "warning", "info"
- message: a one-sentence description of the issue
- rationale: a short explanation of why it matters and, where useful, how to fix it

Respond with ONLY a single valid JSON object matching the FindingsResponse schema \
({"findings": [...]}) — no markdown code fences (no ```json blocks), no surrounding \
text or explanation.
"""

def review(state: ReviewState) -> dict:
    if state.llm_credential is None:
        # Fail closed — no shared/self-hosted fallback. Reaching this node
        # without a resolved BYOK credential means `review_endpoint` didn't
        # do its job; surfacing that as a clear error here is a second line
        # of defense, not the primary check (that's `require_current_user` +
        # the DB lookup in main.py, which should reject the request before
        # the graph ever runs).
        raise ValueError(
            "No LLM provider credential configured for this account. "
            "Connect a Groq or OpenRouter key in the Rio dashboard settings."
        )

    llm = build_llm(state.llm_credential)
    # Function calling, not free-form JSON: the provider constrains the model
    # to emit a tool call against the FindingsResponse schema, so it can't
    # write prose or a fenced JSON block. langchain parses the tool arguments
    # (fence-tolerant via parse_json_markdown) and validates them into the
    # pydantic model. A missing/broken tool call surfaces as
    # OutputParserException (a ValueError) or ValidationError below.
    structured_llm = llm.with_structured_output(FindingsResponse, method="function_calling")

    human_message = f"""## Retrieved context from the repository
                        {format_context(state.context)}
                        ## Diff to review
                        {state.diff}"""
    provider_name = PROVIDER_DISPLAY_NAMES[state.llm_credential.provider]
    model_name = state.llm_credential.model
    try:
        response: FindingsResponse = structured_llm.invoke(
            [
                ("system", REVIEW_SYSTEM_PROMPT),
                ("human", human_message),
            ]
        )
    except APIStatusError as exc:
        # Covers a bad/nonexistent model name (404), a malformed request
        # (400), a revoked/invalid provider key (401), and rate limits (429)
        # — all surfaced with the provider's own message rather than a raw
        # traceback, so the user can tell *what* to fix in their settings.
        if exc.status_code in (401, 403):
            raise ProviderCredentialError(
                f"{provider_name} rejected the configured API key "
                f"(status {exc.status_code}). It may be invalid or revoked — "
                "reconnect your key in the Rio dashboard settings."
            ) from exc
        if exc.status_code == 404:
            raise ProviderCredentialError(
                f"{provider_name} could not find the model '{model_name}'. "
                "Check the model name in your Rio dashboard settings."
            ) from exc
        raise ProviderCredentialError(
            f"{provider_name} rejected the request (status {exc.status_code}): "
            f"{exc.message}"
        ) from exc
    except APIConnectionError as exc:
        raise ProviderCredentialError(
            f"Could not reach {provider_name} — the provider may be down, or there's "
            "a network issue between Rio and the provider."
        ) from exc
    except ValueError as exc:
        # Covers langchain's OutputParserException (missing/broken tool call)
        # and pydantic ValidationError (malformed args) — both ValueError
        # subclasses — so an unparseable model response is a clean 4xx, not a 500.
        logger.warning(
            "unparseable model response (%s: %s)", type(exc).__name__, exc
        )
        raise ProviderCredentialError(
            f"{provider_name} returned a response that could not be parsed as a "
            f"review (model '{model_name}'). This is usually transient; try again."
        ) from exc

    min_rank = SEVERITY_RANK[state.config.min_severity]
    filtered = [f for f in response.findings if SEVERITY_RANK[f.severity] >= min_rank]

    filtered.sort(key=lambda f : SEVERITY_RANK[f.severity] ,reverse=True)
    capped = filtered[: state.config.max_comments_per_pr]
    return {"findings" : capped}

def enrich(state : ReviewState) -> dict:
    if state.repo_id is None:
        return {"context": []}
    all_candidates : list[RetrievedChunk] = []

    try:
        for pf in state.parsed_files:
            query_text = "\n".join(pf.added_lines.values())
            if not query_text.strip():
                continue

            vector = get_embeddings().embed_query(query_text)
            results = get_index().query(
                vector=vector,
                top_k=3,
                namespace=state.repo_id,
                include_metadata=True
            )

            for match in results.matches:
                if match.metadata["file_path"] == pf.path:
                    continue
                all_candidates.append(RetrievedChunk(
                    file_path=match.metadata["file_path"],
                    start_line=match.metadata["start_line"],
                    end_line=match.metadata["end_line"],
                    text=match.metadata["text"],
                    score=match.score, 
                ))
    except Exception as exc:  # noqa: BLE001 — deliberate: degrade on any provider/network failure
        # Context retrieval is best-effort — it only informs the review and
        # is never cited directly. If Pinecone or the embedding service is
        # unreachable (or not yet configured), degrade to no context rather
        # than failing the whole review.
        logger.warning("context retrieval skipped: %s", exc)
        return {"context": []}
        
    all_candidates.sort(key=lambda c: c.score, reverse=True)
  
    context: list[RetrievedChunk] = []
    total = 0
    for c in all_candidates:
        if total + len(c.text) > MAX_CONTEXT_CHARS:
            break
        context.append(c)
        total += len(c.text)

    return {"context": context}

def verify(state : ReviewState) -> dict:
    valid_lines_by_file = {pf.path : set(pf.added_lines.keys()) for pf in state.parsed_files }

    line_verified = [f for f in state.findings if f.file in valid_lines_by_file and f.line in valid_lines_by_file[f.file]
    ]

    lint_locations = {(lr.file , lr.line) for lr in state.lint_results}

    corroborated = [
        f for f in line_verified
        if f.severity != "info" or (f.file , f.line) in lint_locations
    ]

    return {"findings": corroborated}

        