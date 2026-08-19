import json
import shutil
import subprocess

import pytest
from rio_core.sandbox import SandboxOutput

pytestmark = pytest.mark.skipif(
    shutil.which("docker") is None,
    reason="docker is required for the sandbox E2E test",
)

REPO_FILES = {
    "fix.py": "import os\n\ndef unused(x):\n    return 42\n",
    "eslint.config.js": (
        "export default [{ rules: { \"no-unused-vars\": \"error\" },"
        " languageOptions: { ecmaVersion: 2022, sourceType: \"module\" } }];\n"
    ),
    "app.js": "const neverUsed = 1;\nconsole.log(\"hi\");\n",
    "main.go": "package main\n\nfunc main() {}\n",
}


def test_sandbox_image_end_to_end(tmp_path):
    # Build a fixture repo on the host; the container mounts it at /workspace.
    for name, content in REPO_FILES.items():
        (tmp_path / name).write_text(content)

    payload = json.dumps({
        "repo_path": "/workspace",
        "changed_files": list(REPO_FILES),
    })

    result = subprocess.run(
        [
            "docker", "run", "--rm", "-i",
            "-v", f"{tmp_path}:/workspace",
            "sandbox-runner:latest",
            "python3", "-m", "app.sandbox_entrypoint",
        ],
        input=payload,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    output = SandboxOutput.model_validate_json(result.stdout)

    tools = {(lr.file, lr.tool, lr.rule_id) for lr in output.lint_results}
    # ruff finds the unused import on fix.py.
    assert ("fix.py", "ruff", "F401") in tools
    # eslint finds the unused var on app.js (flat config — the whole point of
    # the hand-rolled runner over MegaLinter's bundled ESLint).
    assert ("app.js", "eslint", "no-unused-vars") in tools
    # The .go file is not handled by the own-image runners.
    assert output.unhandled_files == ["main.go"]