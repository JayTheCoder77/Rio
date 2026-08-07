from pydantic import BaseModel, Field
from rio_core.models import Finding, ParsedFile, RetrievedChunk


class ReviewState(BaseModel):
    diff: str
    repo_id : str | None = None
    config: dict = Field(default_factory=dict)
    parsed_files: list[ParsedFile] = Field(default_factory=list)
    context : list[RetrievedChunk] = Field(default_factory=list)
    findings: list[Finding] = Field(default_factory=list)

class IndexRepoRequest(BaseModel):
    repo_path : str
    repo_id : str
