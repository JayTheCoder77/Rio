import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI
from rio_core.sandbox import SandboxOutput, VerifyInput

from app.ruff_runner import run_ruff

app = FastAPI()

@app.get("/v1/health")
def health() -> dict:
    return {"status" : "ok"}

@app.post("/v1/verify")
def verify_endpoint(data : VerifyInput) -> SandboxOutput:
    # orchestrator.py's Docker-in-Docker path (spawning sibling containers,
    # plus megalinter for Go) has no equivalent on a plain hosted container —
    # Render's free tier has no Docker socket. This runs ruff directly
    # in-process instead, against a temp dir built from the shipped file
    # contents. JS/TS (eslint) was dropped: a shipped eslint.config.js
    # commonly imports plugins (@eslint/js, typescript-eslint, etc.) that
    # aren't installed in this image, so it silently no-ops rather than
    # actually lints on most real repos — not worth the false confidence.
    # Any non-Python file just lands in unhandled_files, same as Go today.
    tmp_dir = tempfile.mkdtemp(prefix="rio-verify-")
    try:
        for f in data.files:
            dest = Path(tmp_dir) / f.path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(f.content, encoding="utf-8")

        file_paths = [f.path for f in data.files]
        py_files = [f for f in file_paths if f.endswith(".py")]

        lint_results = run_ruff(tmp_dir, py_files)
        unhandled_files = [f for f in file_paths if f not in py_files]

        return SandboxOutput(lint_results=lint_results, unhandled_files=unhandled_files)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)