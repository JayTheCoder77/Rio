import typer

from rio_cli.git import (
    _get_combined_diff,
    _get_committed_diff,
    _get_diff_from_file,
    _get_staged_diff,
    _get_uncommitted_diff,
    _get_untracked_diff,
    _try_committed_diff,
    _try_staged_diff,
    _try_uncommitted_diff,
)
from rio_cli.output import render_findings
from rio_cli.post import _post_review
from rio_cli.utils import _fail

app = typer.Typer()


@app.callback()
def callback():
    pass

def _resolve_diff(
    staged: bool,
    uncommitted: bool,
    committed: bool,
    diff_file: str | None,
    include_untracked: bool,
) -> str:
    if include_untracked:
        # soft: let empty scopes pass through, only fail if everything (incl. untracked) is empty
        if diff_file:
            base = _get_diff_from_file(diff_file)
        elif uncommitted:
            base = _try_uncommitted_diff()
        elif committed:
            base = _try_committed_diff()
        elif staged:
            base = _try_staged_diff()
        else:
            base = _try_committed_diff() + _try_uncommitted_diff()

        untracked = _get_untracked_diff()
        combined = base + untracked
        if not combined.strip():
            _fail("No changes found (including untracked files).")
        return combined

    # hard: existing behavior, each scope fails loudly if empty
    if diff_file:
        return _get_diff_from_file(diff_file)
    elif uncommitted:
        return _get_uncommitted_diff()
    elif committed:
        return _get_committed_diff()
    elif staged:
        return _get_staged_diff()
    else:
        return _get_combined_diff()

@app.command()
def review(
    staged : bool = typer.Option(False , "--staged"),
    uncommitted: bool = typer.Option(False, "--uncommitted"),
    committed: bool = typer.Option(False, "--committed"),
    diff_file : str | None = typer.Option(None , "--diff"),
    include_untracked: bool = typer.Option(False, "--include-untracked"),
):
    """ Print Findings for a local diff """
    flags_set = sum([staged, uncommitted, committed, diff_file is not None])
    if flags_set > 1:
        _fail("Error: --staged, --uncommitted, --committed, and --diff cannot be used together.")
  
    diff_text = _resolve_diff(staged, uncommitted,committed, diff_file, include_untracked)

    result = _post_review(diff_text)
    render_findings(result)

if __name__ == "__main__":
    app()