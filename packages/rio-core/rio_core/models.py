from typing import Literal

from pydantic import BaseModel


class ParsedFile(BaseModel):
    path: str
    added_lines: set[int]


class Finding(BaseModel):
    file: str
    line: int
    severity: Literal["critical", "warning", "info"]
    message: str
    rationale: str
