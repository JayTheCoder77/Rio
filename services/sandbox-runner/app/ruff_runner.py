import json
import os
import subprocess
import sys

from rio_core.sandbox import LintResult, SandboxInput, SandboxOutput


def run_ruff(repo_path: str, py_files: list[str]) -> list[LintResult]:
    if not py_files:
        return []
    path_map = {os.path.join(repo_path, f): f for f in py_files}
    abs_paths = list(path_map.keys())
    result = subprocess.run(
        ["ruff" , "check" , "--no-cache" , "--output-format=json" , *abs_paths],
        capture_output=True,
        text=True,
        check=False,
    )

    issues = json.loads(result.stdout)
    return [LintResult(
        file=path_map[issue["filename"]],
        line=issue["location"]["row"],
        rule_id=issue["code"],
        message=issue["message"],
        tool="ruff"
    ) for issue in issues]

def main():
    data = SandboxInput.model_validate_json(sys.stdin.read())
    py_files = [f for f in data.changed_files if f.endswith(".py")]
    lint_results = run_ruff(data.repo_path, py_files)
    output = SandboxOutput(lint_results=lint_results)
    print(output.model_dump_json())

if __name__=="__main__":
    main()