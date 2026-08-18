import sys

from rio_core.sandbox import SandboxInput, SandboxOutput

from app.eslint_runner import JS_TS_EXTENSIONS, run_eslint
from app.ruff_runner import run_ruff


def main():
    data = SandboxInput.model_validate_json(sys.stdin.read())
    py_files = [f for f in data.changed_files if f.endswith(".py")]
    js_files = [f for f in data.changed_files if f.endswith(JS_TS_EXTENSIONS)]

    lint_results = run_ruff(data.repo_path, py_files) + run_eslint(data.repo_path, js_files)

    handled = set(py_files) | set(js_files)
    unhandled_files = [f for f in data.changed_files if f not in handled]

    output = SandboxOutput(lint_results=lint_results, unhandled_files=unhandled_files)
    print(output.model_dump_json())

if __name__ == "__main__":
    main()
    
    
    
