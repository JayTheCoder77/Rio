from typing import Literal

from pydantic import BaseModel


class ParsedFile(BaseModel):
    path: str
    added_lines: dict[int , str]

Severity = Literal["critical", "warning", "info"]

class Finding(BaseModel):
    file: str
    line: int
    severity: Severity
    message: str
    rationale: str

class RetrievedChunk(BaseModel):
    file_path : str
    start_line: int
    end_line: int
    text: str
    score: float
