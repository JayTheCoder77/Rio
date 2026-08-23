from pydantic import BaseModel


class SandboxInput(BaseModel):
    repo_path : str
    changed_files : list[str]

class VerifyFile(BaseModel):
    path : str
    content : str

class VerifyInput(BaseModel):
    # Used by the hosted /v1/verify endpoint — worker.ts and sandbox-runner
    # are separate containers with no shared disk, so file contents travel
    # over the wire instead of a repo_path (same shape as IndexRepoRequest
    # in services/ai-engine/app/state.py, same underlying reason).
    files : list[VerifyFile]

class LintResult(BaseModel):
    file : str
    line : int
    rule_id : str
    message : str
    tool : str

class SandboxOutput(BaseModel):
    lint_results : list[LintResult]
    unhandled_files: list[str]
