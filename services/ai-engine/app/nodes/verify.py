import fnmatch

from rio_core.models import Learning

from app.state import ReviewState


def _learning_drops(learning: Learning, file: str, message: str) -> bool:
    if not learning.path_glob and not learning.pattern:
        return False
    if learning.path_glob and not fnmatch.fnmatch(file, learning.path_glob):
        return False
    if not learning.pattern:
        return True
    return learning.pattern.lower() in message.lower()


def verify(state: ReviewState) -> dict:
    valid_lines_by_file = {pf.path: set(pf.added_lines.keys()) for pf in state.parsed_files}

    line_verified = [
        f
        for f in state.findings
        if f.file in valid_lines_by_file and f.line in valid_lines_by_file[f.file]
    ]

    lint_locations = {(lr.file, lr.line) for lr in state.lint_results}

    corroborated = [
        f
        for f in line_verified
        if f.severity != "info" or (f.file, f.line) in lint_locations
    ]

    surviving = [
        f
        for f in corroborated
        if not any(_learning_drops(learning, f.file, f.message) for learning in state.learnings)
    ]

    return {"findings": surviving}
