import fnmatch

from rio_core.diff import parse_diff
from rio_core.models import FileSnapshot, HunkWindow, ParsedFile

from app import limits
from app.errors import DiffTooLargeError
from app.limits import HUNK_WINDOW_RADIUS
from app.state import ReviewState


def _clusters(line_numbers: list[int]) -> list[tuple[int, int]]:
    if not line_numbers:
        return []
    nums = sorted(line_numbers)
    clusters: list[tuple[int, int]] = []
    start = prev = nums[0]
    for n in nums[1:]:
        if n <= prev + 1:
            prev = n
        else:
            clusters.append((start, prev))
            start = prev = n
    clusters.append((start, prev))
    return clusters


def build_hunk_windows(
    parsed_files: list[ParsedFile],
    snapshots: list[FileSnapshot],
    radius: int = HUNK_WINDOW_RADIUS,
) -> list[HunkWindow]:
    by_path = {snap.path: snap.content for snap in snapshots}
    windows: list[HunkWindow] = []
    for pf in parsed_files:
        content = by_path.get(pf.path)
        if content is None or not pf.added_lines:
            continue
        lines = content.splitlines(keepends=True)
        if not lines:
            continue
        for cstart, cend in _clusters(list(pf.added_lines.keys())):
            wstart = max(1, cstart - radius)
            wend = min(len(lines), cend + radius)
            windows.append(
                HunkWindow(
                    file_path=pf.path,
                    start_line=wstart,
                    end_line=wend,
                    text="".join(lines[wstart - 1 : wend]),
                )
            )
    return windows


def ingest(state: ReviewState) -> dict:
    if len(state.diff) > limits.MAX_DIFF_CHARS:
        raise DiffTooLargeError(
            f"diff too large ({len(state.diff)} chars) — cap is {limits.MAX_DIFF_CHARS}. "
            "Review a smaller scope (e.g. `rio review --staged`), or raise the "
            "ai-engine's MAX_DIFF_CHARS env var for your deployment."
        )

    parsed_files = parse_diff(state.diff)
    filtered_files = [
        pf
        for pf in parsed_files
        if not any(fnmatch.fnmatch(pf.path, pattern) for pattern in state.config.ignore_paths)
    ]
    windows = build_hunk_windows(filtered_files, state.file_snapshots)
    return {"parsed_files": filtered_files, "hunk_windows": windows}
