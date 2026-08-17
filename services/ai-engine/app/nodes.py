import fnmatch

from langchain_ollama import ChatOllama, OllamaEmbeddings
from pydantic import BaseModel
from rio_core.config import SEVERITY_RANK
from rio_core.diff import parse_diff
from rio_core.models import Finding, RetrievedChunk

from app.indexing import index
from app.state import ReviewState
from app.utils.utils import format_context

MAX_DIFF_CHARS = 40_000  # rough token-cost guardrail — tune once real PRs start flowing
MAX_CONTEXT_CHARS = 5000
embeddings = OllamaEmbeddings(model="nomic-embed-text")

def ingest(state: ReviewState) -> dict:
    if len(state.diff) > MAX_DIFF_CHARS:
        raise ValueError(f"diff too large ({len(state.diff)} chars) — cap is {MAX_DIFF_CHARS}")
    
    parsed_files = parse_diff(state.diff)
    filtered_files = [
        pf for pf in parsed_files
        if not any (fnmatch.fnmatch(pf.path , pattern) for pattern in state.config.ignore_paths)
   ]
    return {"parsed_files" : filtered_files}

class FindingsResponse(BaseModel):
    findings: list[Finding]

llm = ChatOllama(model="llama3.1:latest", temperature=0)
structured_llm = llm.with_structured_output(FindingsResponse)

REVIEW_SYSTEM_PROMPT = """You are Rio, an automated code reviewer. You are given a unified diff \
of a pull request and must find real, actionable issues introduced by the changes.

Only comment on lines that are added or modified in this diff — never on unchanged \
context lines, and never invent a file or line number that isn't present in the diff. \
Use the line number from the new (target) version of the file, as shown in the diff's \
hunk headers (the `+` side of `@@ -a,b +c,d @@`).

You may also be given retrieved context from elsewhere in the repository, clearly \
labeled as such. Use it only to inform your understanding of the diff — never cite a  \
file or line number from the retrieved context, and never report issues that exist \
only in the retrieved context and not in the diff itself.

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
    human_message = f"""## Retrieved context from the repository
                        {format_context(state.context)}
                        ## Diff to review
                        {state.diff}"""
    response: FindingsResponse = structured_llm.invoke(
        [
            ("system", REVIEW_SYSTEM_PROMPT),
            ("human", human_message),
        ]
    )
    min_rank = SEVERITY_RANK[state.config.min_severity]
    filtered = [f for f in response.findings if SEVERITY_RANK[f.severity] >= min_rank]

    filtered.sort(key=lambda f : SEVERITY_RANK[f.severity] ,reverse=True)
    capped = filtered[: state.config.max_comments_per_pr]
    return {"findings" : capped}

def enrich(state : ReviewState) -> dict:
    if state.repo_id is None:
        return {"context": []}
    all_candidates : list[RetrievedChunk] = []

    for pf in state.parsed_files:
        query_text = "\n".join(pf.added_lines.values())
        if not query_text.strip():
            continue

        vector = embeddings.embed_query(query_text)
        results = index.query(
            vector=vector,
            top_k=3,
            namespace=state.repo_id,
            include_metadata=True
        )

        for match in results.matches:
            if match.metadata["file_path"] == pf.path:
                continue
            all_candidates.append(RetrievedChunk(
                file_path=match.metadata["file_path"],
                start_line=match.metadata["start_line"],
                end_line=match.metadata["end_line"],
                text=match.metadata["text"],
                score=match.score, 
            ))
        
    all_candidates.sort(key=lambda c: c.score, reverse=True)
  
    context: list[RetrievedChunk] = []
    total = 0
    for c in all_candidates:
        if total + len(c.text) > MAX_CONTEXT_CHARS:
            break
        context.append(c)
        total += len(c.text)

    return {"context": context}

def verify(state : ReviewState) -> dict:
    valid_lines_by_file = {pf.path : set(pf.added_lines.keys()) for pf in state.parsed_files }

    line_verified = [f for f in state.findings if f.file in valid_lines_by_file and f.line in valid_lines_by_file[f.file]
    ]

    lint_locations = {(lr.file , lr.line) for lr in state.lint_results}

    corroborated = [
        f for f in line_verified
        if f.severity != "info" or (f.file , f.line) in lint_locations
    ]

    return {"findings": corroborated}

        