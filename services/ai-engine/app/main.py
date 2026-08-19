from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException

from app.auth import (
    get_current_user,
    get_user_llm_credential,
    require_current_user,
    verify_internal_service_token,
)
from app.graph import review_graph
from app.indexing import index_repo
from app.mcp_server import mcp
from app.nodes import ProviderCredentialError
from app.state import IndexRepoRequest, ReviewState


@asynccontextmanager
async def lifespan(app : FastAPI) -> AsyncIterator[None]:
    async with mcp.session_manager.run():
        yield

app = FastAPI(lifespan=lifespan)
app.mount("/mcp-server" , mcp.streamable_http_app())

@app.get("/v1/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/v1/me")
def me_endpoint(user_id: str = Depends(require_current_user)) -> dict:
    """Validates a Rio API key. Used by `rio auth` to catch a bad paste
    immediately, instead of failing later on the first `rio review`."""
    return {"user_id": user_id}


@app.post("/v1/review")
def review_endpoint(
    state: ReviewState,
    user_id: str | None = Depends(get_current_user),
    is_internal_service: bool = Depends(verify_internal_service_token),
) -> ReviewState:
    # Two distinct trust boundaries, see `app.auth.verify_internal_service_token`:
    #   1. CLI path — caller authenticates as a real Rio user via Bearer key.
    #   2. Worker/GitHub App path — caller is our own trusted worker, which
    #      has already resolved the owning Rio user for this installation
    #      itself and asserts it via `on_behalf_of_user_id`.
    if is_internal_service and state.on_behalf_of_user_id:
        resolved_user_id = state.on_behalf_of_user_id
    elif user_id is not None:
        resolved_user_id = user_id
    else:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

    credential = get_user_llm_credential(resolved_user_id)
    if credential is None:
        # Fail closed: no shared/self-hosted key runs on a stranger's behalf.
        raise HTTPException(
            status_code=412,
            detail=(
                "No LLM provider configured for this account. Connect a Groq or "
                "OpenRouter key in the Rio dashboard settings before running a review."
            ),
        )
    state.llm_credential = credential
    state.on_behalf_of_user_id = None

    try:
        result = review_graph.invoke(state)
    except ProviderCredentialError as exc:
        # The credential exists but the provider rejected it (bad model
        # name, revoked key, rate limit, etc.) — distinct from 412 (no
        # credential configured at all). 422: request was well-formed and
        # authenticated, but couldn't be processed as specified.
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    # check what shape `result` actually comes back as once you run this —
    # langgraph may hand back a plain dict of the final state rather than a
    # ReviewState instance; adjust this line if FastAPI complains.
    result_state = ReviewState(**result)
    # Never echo the provider credential back to the caller.
    result_state.llm_credential = None
    return result_state

@app.post("/v1/index/repo")
def index_endpoint(repo: IndexRepoRequest) -> dict:
    count = index_repo(repo.repo_path , repo.repo_id)
    return {"status" : "ok" , "chunks_indexed" : count}

