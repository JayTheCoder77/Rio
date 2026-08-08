import subprocess
from typing import NoReturn

import typer


def _fail(message : str) -> NoReturn:
    typer.echo(message , err=True)
    raise typer.Exit(code=1)

def _try_run_git_diff(args: list[str]) -> str:
    """Run git diff with the given args. Returns ""on any failure or empty result."""
    try:
        result = subprocess.run(
            ["git", "diff", *args],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return ""

    if result.returncode != 0:
        return ""

    return result.stdout

def _run_git_diff(args: list[str], empty_message: str) -> str:
    """Run git diff, hard-failing (via _fail) on any error or empty result."""
    output = _try_run_git_diff(args)
    if not output.strip():
        _fail(empty_message)
    return output