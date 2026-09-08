import logging

from rio_core.models import KnowledgeSnippet, ParsedFile, RetrievedChunk

from app.indexing import get_embeddings, get_index

logger = logging.getLogger(__name__)

CODE_TOP_K_PER_FILE = 3
GLOBAL_CODE_CAP = 8
KNOWLEDGE_TOP_K = 3


def _is_code_match(match) -> bool:
    kind = match.metadata.get("kind")
    return kind in (None, "code")


def retrieve_code(
    parsed_files: list[ParsedFile],
    repo_id: str,
    skip_paths: set[str] | None = None,
) -> list[RetrievedChunk]:
    skip_paths = skip_paths or set()
    all_candidates: list[RetrievedChunk] = []

    for pf in parsed_files:
        snippets = "\n".join(pf.added_lines.values())
        query_text = f"{pf.path}\n{snippets}".strip()
        if not query_text.strip():
            continue

        vector = get_embeddings().embed_query(query_text)
        results = get_index().query(
            vector=vector,
            top_k=CODE_TOP_K_PER_FILE,
            namespace=repo_id,
            include_metadata=True,
        )

        for match in results.matches:
            if not _is_code_match(match):
                continue
            path = match.metadata["file_path"]
            if path in skip_paths:
                continue
            all_candidates.append(
                RetrievedChunk(
                    file_path=path,
                    start_line=match.metadata["start_line"],
                    end_line=match.metadata["end_line"],
                    text=match.metadata["text"],
                    score=match.score,
                )
            )

    all_candidates.sort(key=lambda c: c.score, reverse=True)
    return all_candidates[:GLOBAL_CODE_CAP]


def retrieve_knowledge(
    parsed_files: list[ParsedFile],
    repo_id: str,
    kind: str,
) -> list[KnowledgeSnippet]:
    snippets = "\n".join(
        f"{pf.path}\n" + "\n".join(pf.added_lines.values()) for pf in parsed_files
    )
    query_text = snippets.strip()
    if not query_text:
        return []

    vector = get_embeddings().embed_query(query_text)
    results = get_index().query(
        vector=vector,
        top_k=KNOWLEDGE_TOP_K,
        namespace=repo_id,
        include_metadata=True,
        filter={"kind": {"$eq": kind}},
    )

    out: list[KnowledgeSnippet] = []
    for match in results.matches:
        meta = match.metadata
        if meta.get("kind") != kind:
            continue
        out.append(
            KnowledgeSnippet(
                kind=kind,  # type: ignore[arg-type]
                number=int(meta.get("number", 0)),
                title=meta.get("title") or "",
                text=meta.get("text") or "",
                score=match.score,
            )
        )
    return out
