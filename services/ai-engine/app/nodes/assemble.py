import fnmatch
import logging

from rio_core.models import Learning, PathGuideline

from app.knowledge.code_index import retrieve_code, retrieve_knowledge
from app.knowledge.pack import pack_context
from app.knowledge.store import load_guidelines, load_learnings
from app.state import ReviewState

logger = logging.getLogger(__name__)


def _guideline_matches(guideline: PathGuideline, paths: list[str]) -> bool:
    if not guideline.paths:
        return True
    return any(
        fnmatch.fnmatch(path, glob)
        for path in paths
        for glob in guideline.paths
    )


def _learning_applies_to_paths(learning: Learning, paths: list[str]) -> bool:
    if not learning.path_glob:
        return True
    return any(fnmatch.fnmatch(path, learning.path_glob) for path in paths)


def assemble_context(state: ReviewState) -> dict:
    paths = [pf.path for pf in state.parsed_files]
    yaml_guidelines = [
        g.text for g in state.config.guidelines if _guideline_matches(g, paths)
    ]

    db_guidelines: list[PathGuideline] = []
    learnings: list[Learning] = []
    code = []
    issues = []
    prs = []

    if state.repo_id is not None:
        db_guidelines = load_guidelines(state.repo_id)
        learnings = load_learnings(state.repo_id)
        skip_paths = {w.file_path for w in state.hunk_windows}
        try:
            code = retrieve_code(state.parsed_files, state.repo_id, skip_paths=skip_paths)
        except Exception as exc:  # noqa: BLE001 — retrieval is best-effort
            logger.warning("code retrieval skipped: %s", exc)
        try:
            issues = retrieve_knowledge(state.parsed_files, state.repo_id, "issue")
        except Exception as exc:  # noqa: BLE001
            logger.warning("issue retrieval skipped: %s", exc)
        try:
            prs = retrieve_knowledge(state.parsed_files, state.repo_id, "pr")
        except Exception as exc:  # noqa: BLE001
            logger.warning("pr retrieval skipped: %s", exc)

    db_guideline_texts = [
        g.text for g in db_guidelines if _guideline_matches(g, paths)
    ]
    learning_texts = [
        learning.instruction
        for learning in learnings
        if _learning_applies_to_paths(learning, paths)
    ]

    pack = pack_context(
        guidelines=yaml_guidelines + db_guideline_texts,
        learnings=learning_texts,
        hunk_windows=state.hunk_windows,
        code=code,
        issues=issues,
        prs=prs,
    )
    return {"context": pack, "learnings": learnings}


enrich = assemble_context
