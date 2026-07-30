import json
import os
import subprocess
import sys

from rio_core.sandbox import LintResult, SandboxInput, SandboxOutput

JS_TS_EXTENSIONS = (".js", ".jsx", ".ts", ".tsx")

def has_eslint_config(repo_path: str) -> bool:
    return any(
        os.path.exists(os.path.join(repo_path, f"eslint.config.{ext}"))
        for ext in ("js", "mjs", "cjs")
    )

def run_eslint(repo_path: str, js_files: list[str]) -> list[LintResult]:
    if not js_files or not has_eslint_config(repo_path):
        return []

    path_map = {os.path.join(repo_path, f): f for f in js_files}
    abs_paths = list(path_map.keys())

    result = subprocess.run(
        ["eslint", "--format", "json", *abs_paths],
        capture_output=True, text=True, check=False,
    )

    file_results = json.loads(result.stdout)
    lint_results: list[LintResult] = []
    for file_result in file_results:
        for msg in file_result["messages"]:
            lint_results.append(LintResult(
                file=file_result["filePath"],
                line=msg["line"],
                rule_id=msg["ruleId"] or "parse-error",
                message=msg["message"],
                tool="eslint",
            ))
    return lint_results

def main():
    data = SandboxInput.model_validate_json(sys.stdin.read())
    js_files = [f for f in data.changed_files if f.endswith(JS_TS_EXTENSIONS)]
    lint_results = run_eslint(data.repo_path, js_files)
    output = SandboxOutput(lint_results=lint_results)
    print(output.model_dump_json())

if __name__ == "__main__":
    main()

    
