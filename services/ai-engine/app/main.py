from fastapi import FastAPI

from app.graph import review_graph
from app.indexing import index_repo
from app.state import IndexRepoRequest, ReviewState

app = FastAPI()


@app.get("/v1/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/v1/review")
def review_endpoint(state: ReviewState) -> ReviewState:
    result = review_graph.invoke(state)
    # check what shape `result` actually comes back as once you run this —
    # langgraph may hand back a plain dict of the final state rather than a
    # ReviewState instance; adjust this line if FastAPI complains.
    return ReviewState(**result)

@app.post("/v1/index/repo")
def index_endpoint(repo: IndexRepoRequest) -> dict:
    count = index_repo(repo.repo_path , repo.repo_id)
    return {"status" : "ok" , "chunks_indexed" : count}

