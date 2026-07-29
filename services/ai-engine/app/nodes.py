from langchain_ollama import ChatOllama
from pydantic import BaseModel

from rio_core.diff import parse_diff
from rio_core.models import Finding

from app.state import ReviewState

MAX_DIFF_CHARS = 40_000  # rough token-cost guardrail — tune once real PRs start flowing


def ingest(state: ReviewState) -> dict:
    if len(state.diff) > MAX_DIFF_CHARS:
        raise ValueError(f"diff too large ({len(state.diff)} chars) — cap is {MAX_DIFF_CHARS}")
    return {"parsed_files": parse_diff(state.diff)}


class FindingsResponse(BaseModel):
    findings: list[Finding]


llm = ChatOllama(model="llama3.1", temperature=0)
structured_llm = llm.with_structured_output(FindingsResponse)

REVIEW_SYSTEM_PROMPT = """You are Rio, an automated code reviewer. You are given a unified diff \
of a pull request and must find real, actionable issues introduced by the changes.

Only comment on lines that are added or modified in this diff — never on unchanged \
context lines, and never invent a file or line number that isn't present in the diff. \
Use the line number from the new (target) version of the file, as shown in the diff's \
hunk headers (the `+` side of `@@ -a,b +c,d @@`).

For each issue, assign a severity:
- "critical": bugs, security vulnerabilities, data loss, or correctness errors that \
will cause incorrect behavior in production.
- "warning": design or maintainability problems that aren't outright bugs — poor \
error handling, missing edge cases, unclear naming, code likely to cause a bug later.
- "info": minor style or clarity suggestions worth mentioning but not blocking.

Be selective. A diff with no real issues should return an empty findings list — do not \
invent minor nitpicks just to have something to say. Prioritize signal over volume; a \
reviewer who comments on everything is as useless as one who comments on nothing.

For each finding, give:
- file: the file path as it appears in the diff
- line: the target-file line number
- severity: one of "critical", "warning", "info"
- message: a one-sentence description of the issue
- rationale: a short explanation of why it matters and, where useful, how to fix it
"""

def review(state: ReviewState) -> dict:
    response: FindingsResponse = structured_llm.invoke(
        [
            ("system", REVIEW_SYSTEM_PROMPT),
            ("human", state.diff),
        ]
    )
    return {"findings": response.findings}
