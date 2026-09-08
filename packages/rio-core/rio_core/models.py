from typing import Literal

from pydantic import BaseModel, Field


class ParsedFile(BaseModel):
    path: str
    added_lines: dict[int, str]

Severity = Literal["critical", "warning", "info"]

class Finding(BaseModel):
    file: str
    line: int
    severity: Severity
    message: str
    rationale: str

class RetrievedChunk(BaseModel):
    file_path: str
    start_line: int
    end_line: int
    text: str
    score: float

class FileSnapshot(BaseModel):
    path: str
    content: str

class HunkWindow(BaseModel):
    file_path: str
    start_line: int
    end_line: int
    text: str

class PathGuideline(BaseModel):
    paths: list[str] = Field(default_factory=list)
    text: str

class Learning(BaseModel):
    path_glob: str | None = None
    pattern: str | None = None
    instruction: str

class KnowledgeSnippet(BaseModel):
    kind: Literal["pr", "issue"]
    number: int
    title: str
    text: str
    score: float = 0.0

class ContextPack(BaseModel):
    guidelines: list[str] = Field(default_factory=list)
    learnings: list[str] = Field(default_factory=list)
    hunk_windows: list[HunkWindow] = Field(default_factory=list)
    code: list[RetrievedChunk] = Field(default_factory=list)
    issues: list[KnowledgeSnippet] = Field(default_factory=list)
    prs: list[KnowledgeSnippet] = Field(default_factory=list)

class Symbol(BaseModel):
    name: str
    kind: str = "unknown"
    start_line: int = 0
    end_line: int = 0
