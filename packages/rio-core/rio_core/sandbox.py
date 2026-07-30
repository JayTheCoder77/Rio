from pydantic import BaseModel


class SandboxInput(BaseModel):
    repo_path : str
    changed_files : list[str]

class LintResult(BaseModel):
    file : str
    line : int
    rule_id : str
    message : str
    tool : str

class SandboxOutput(BaseModel):
    lint_results : list[LintResult]
    unhandled_files: list[str]
