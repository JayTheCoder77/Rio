from rio_core.models import ContextPack, HunkWindow, KnowledgeSnippet, RetrievedChunk

from app.limits import MAX_CONTEXT_CHARS

# Per-section ceilings so vector hits cannot crowd out tiny, high-precision
# sections. Guidelines/learnings go first and have no extra ceiling.
SECTION_CEILINGS = {
    "hunk_windows": 2500,
    "code": 2000,
    "issues": 800,
    "prs": 800,
}


def _take_strings(items: list[str], remaining: int, ceiling: int | None) -> tuple[list[str], int]:
    cap = remaining if ceiling is None else min(remaining, ceiling)
    kept: list[str] = []
    used = 0
    for item in items:
        n = len(item)
        if used + n > cap:
            break
        kept.append(item)
        used += n
    return kept, remaining - used


def pack_context(
    *,
    guidelines: list[str],
    learnings: list[str],
    hunk_windows: list[HunkWindow],
    code: list[RetrievedChunk],
    issues: list[KnowledgeSnippet],
    prs: list[KnowledgeSnippet],
    budget: int = MAX_CONTEXT_CHARS,
) -> ContextPack:
    remaining = budget

    packed_guidelines, remaining = _take_strings(guidelines, remaining, None)
    packed_learnings, remaining = _take_strings(learnings, remaining, None)

    hunk_cap = min(remaining, SECTION_CEILINGS["hunk_windows"])
    packed_hunks: list[HunkWindow] = []
    used = 0
    for window in hunk_windows:
        n = len(window.text)
        if used + n > hunk_cap:
            break
        packed_hunks.append(window)
        used += n
    remaining -= used

    code_cap = min(remaining, SECTION_CEILINGS["code"])
    packed_code: list[RetrievedChunk] = []
    used = 0
    for chunk in code:
        n = len(chunk.text)
        if used + n > code_cap:
            break
        packed_code.append(chunk)
        used += n
    remaining -= used

    issue_cap = min(remaining, SECTION_CEILINGS["issues"])
    packed_issues: list[KnowledgeSnippet] = []
    used = 0
    for snippet in issues:
        n = len(snippet.text) + len(snippet.title)
        if used + n > issue_cap:
            break
        packed_issues.append(snippet)
        used += n
    remaining -= used

    pr_cap = min(remaining, SECTION_CEILINGS["prs"])
    packed_prs: list[KnowledgeSnippet] = []
    used = 0
    for snippet in prs:
        n = len(snippet.text) + len(snippet.title)
        if used + n > pr_cap:
            break
        packed_prs.append(snippet)
        used += n

    return ContextPack(
        guidelines=packed_guidelines,
        learnings=packed_learnings,
        hunk_windows=packed_hunks,
        code=packed_code,
        issues=packed_issues,
        prs=packed_prs,
    )


def format_pack(pack: ContextPack) -> str:
    parts: list[str] = []

    if pack.guidelines:
        body = "\n".join(f"- {g}" for g in pack.guidelines)
        parts.append(f"## Coding guidelines\n{body}")

    if pack.learnings:
        body = "\n".join(f"- {item}" for item in pack.learnings)
        parts.append(f"## Learnings (do not re-flag these)\n{body}")

    if pack.hunk_windows:
        windows = "\n\n".join(
            f"### {w.file_path} (lines {w.start_line}-{w.end_line})\n{w.text}"
            for w in pack.hunk_windows
        )
        parts.append(f"## Surrounding code from changed files\n{windows}")

    if pack.code:
        chunks = "\n\n".join(
            f"### {c.file_path} (lines {c.start_line}-{c.end_line})\n{c.text}"
            for c in pack.code
        )
        parts.append(f"## Related code from elsewhere in the repository\n{chunks}")

    if pack.issues:
        issues = "\n\n".join(
            f"### Issue #{s.number}: {s.title}\n{s.text}" for s in pack.issues
        )
        parts.append(f"## Related issues\n{issues}")

    if pack.prs:
        prs = "\n\n".join(
            f"### PR #{s.number}: {s.title}\n{s.text}" for s in pack.prs
        )
        parts.append(f"## Related pull requests\n{prs}")

    if not parts:
        return "No related context was retrieved."
    return "\n\n".join(parts)


def format_context(chunks: list[RetrievedChunk]) -> str:
    """Legacy helper used by older tests; prefer format_pack."""
    if not chunks:
        return "No related context was retrieved."
    parts = [
        f"### {c.file_path} (lines {c.start_line}-{c.end_line})\n{c.text}"
        for c in chunks
    ]
    return "\n\n".join(parts)
