from typing import Literal

from pydantic import BaseModel, Field
from rio_core import LintResult, RioConfig
from rio_core.models import Finding, ParsedFile, RetrievedChunk


class LlmCredential(BaseModel):
    """The caller's BYOK provider credential, resolved server-side from their
    Rio account (see `app.auth.get_user_llm_credential`) and attached to the
    state before the graph runs. Never returned to the client — stripped out
    in `main.py` before the response is sent. Field is named `llm_credential`
    rather than `model_config`, which is a reserved attribute on every
    Pydantic BaseModel."""

    provider: Literal["groq", "openrouter"]
    api_key: str
    model: str


class ReviewState(BaseModel):
    diff: str
    repo_id : str | None = None
    config: RioConfig = Field(default_factory=RioConfig)
    parsed_files: list[ParsedFile] = Field(default_factory=list)
    context : list[RetrievedChunk] = Field(default_factory=list)
    findings: list[Finding] = Field(default_factory=list)
    lint_results: list[LintResult] = Field(default_factory=list)
    llm_credential: LlmCredential | None = None
    # Set only by the trusted worker path (see `app.auth.resolve_review_user`)
    # — the GitHub App has no per-request Rio API key to authenticate with,
    # so the worker instead asserts "run this review on behalf of this
    # already-resolved Rio user id", authenticated via a separate internal
    # service token rather than a user-facing Bearer key. Never returned to
    # the client — stripped out in `main.py` before the response is sent.
    on_behalf_of_user_id: str | None = None

class IndexFile(BaseModel):
    path: str
    content: str

class IndexRepoRequest(BaseModel):
    # Was `repo_path: str` — a path on the *worker's* disk, which ai-engine
    # (a separate container) can never see. The worker now walks the clone
    # itself and ships file contents directly; see `apps/worker/src/indexWorker.ts`.
    files: list[IndexFile]
    repo_id : str
