from pydantic import BaseModel, Field
from rio_core import LintResult, RioConfig
from rio_core.models import Finding, ParsedFile, RetrievedChunk


class ReviewState(BaseModel):
    diff: str
    repo_id : str | None = None
    config: RioConfig = Field(default_factory=RioConfig)
    parsed_files: list[ParsedFile] = Field(default_factory=list)
    context : list[RetrievedChunk] = Field(default_factory=list)
    findings: list[Finding] = Field(default_factory=list)
    lint_results: list[LintResult] = Field(default_factory=list)

class IndexRepoRequest(BaseModel):
    repo_path : str
    repo_id : str
