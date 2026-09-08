from pydantic import BaseModel, Field

from rio_core.models import PathGuideline, Severity

SEVERITY_RANK: dict[str, int] = {"info": 0, "warning": 1, "critical": 2}

class RioConfig(BaseModel):
    ignore_paths: list[str] = []
    min_severity: Severity = "info"
    max_comments_per_pr: int = 10
    require_check: bool = False
    guidelines: list[PathGuideline] = Field(default_factory=list)


