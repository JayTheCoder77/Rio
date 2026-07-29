from pydantic import BaseModel, Field

from rio_core.models import Finding, ParsedFile


class ReviewState(BaseModel):
    diff: str
    config: dict = Field(default_factory=dict)
    parsed_files: list[ParsedFile] = Field(default_factory=list)
    findings: list[Finding] = Field(default_factory=list)
