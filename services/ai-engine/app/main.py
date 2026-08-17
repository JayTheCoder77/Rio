from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI

from app.auth import get_current_user
from app.graph import review_graph
from app.indexing import index_repo
from app.mcp_server import mcp
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


@app.post("/v1/review")
def review_endpoint(state: ReviewState , user_id : str | None = Depends(get_current_user)) -> ReviewState:
    result = review_graph.invoke(state)
    # check what shape `result` actually comes back as once you run this —
    # langgraph may hand back a plain dict of the final state rather than a
    # ReviewState instance; adjust this line if FastAPI complains.
    return ReviewState(**result)

@app.post("/v1/index/repo")
def index_endpoint(repo: IndexRepoRequest) -> dict:
    count = index_repo(repo.repo_path , repo.repo_id)
    return {"status" : "ok" , "chunks_indexed" : count}

