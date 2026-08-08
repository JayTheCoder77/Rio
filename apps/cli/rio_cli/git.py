import subprocess
from pathlib import Path

from rio_cli.utils import _fail, _run_git_diff, _try_run_git_diff


def _get_staged_diff() -> str:
    return _run_git_diff(["--staged"], "No staged changes found.")

def _get_uncommitted_diff() -> str:
    return _run_git_diff(["HEAD"], "No uncommitted changes found.")

def _get_diff_from_file(path: str) -> str:
    try:
        return Path(path).read_text()
    except FileNotFoundError:
        _fail(f"Error: File not found : {path}")

def _try_staged_diff() -> str:
    return _try_run_git_diff(["--staged"])

def _try_uncommitted_diff() -> str:
    return _try_run_git_diff(["HEAD"])

def _try_committed_diff() -> str:
    upstream_check = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
        capture_output=True,
        text=True,
        check=False,
    )
    if upstream_check.returncode != 0:
        return ""  # no upstream configured — treat as "nothing to show", not an error

    upstream_ref = upstream_check.stdout.strip()
    return _try_run_git_diff([f"{upstream_ref}...HEAD"])
    
def _get_committed_diff() -> str:
    """Hard-fail variant for the explicit --committed flag."""
    upstream_check = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
        capture_output=True,
        text=True,
        check=False,
    )
    if upstream_check.returncode != 0:
        _fail("Error: no upstream branch configured — can't determine committed-but-unpushed changes.")

    upstream_ref = upstream_check.stdout.strip()
    return _run_git_diff([f"{upstream_ref}...HEAD"],"No committed (unpushed) changes found.")


def _get_combined_diff() -> str:
    """Default (no-flags) behavior: committed-unpushed + uncommitted, whichever exist."""
    committed = _try_committed_diff()
    uncommitted = _try_run_git_diff(["HEAD"])

    combined = committed + uncommitted
    if not combined.strip():
        _fail("No committed or uncommitted changes found.")

    return combined
    
def _get_untracked_files() -> list[str]:
    result = subprocess.run(["git", "ls-files", "--others","--exclude-standard"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return []
    return [line for line in result.stdout.splitlines() if line.strip()]

def _get_untracked_diff() -> str:
    """Synthetic diffs for untracked files, via git diff --no-index against /dev/null."""
    paths = _get_untracked_files()
    diffs = []
    for path in paths:
        result = subprocess.run(
            ["git", "diff", "--no-index", "/dev/null", path],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode not in (0, 1):
            continue  # real error for this file — skip rather than fail the whole command
        if result.stdout.strip():
            diffs.append(result.stdout)
  
    return "\n".join(diffs)