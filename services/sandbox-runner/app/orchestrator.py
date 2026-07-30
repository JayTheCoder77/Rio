import os
import subprocess
import tempfile
import uuid

from rio_core.sandbox import SandboxInput, SandboxOutput

from app.megalinter_translator import translate_sarif

DOCKER_TIMEOUT_S = 120
LANGUAGE_LINTERS = {
    ".go": ["GO_GOLANGCI_LINT", "GO_REVIVE"],
}

def run_docker(args: list[str], **kwargs) -> subprocess.CompletedProcess:
    name = f"rio-sandbox-{uuid.uuid4().hex[:8]}"
    try:
        return subprocess.run(
            ["docker", "run", "--rm", "--name", name, "--memory=512m", "--cpus=1", *args],
            timeout=DOCKER_TIMEOUT_S, check=False, **kwargs,
        )
    except subprocess.TimeoutExpired:
        subprocess.run(["docker", "kill", name], check=False)
        raise

def run_own_image(data: SandboxInput) -> SandboxOutput:
    container_input = data.model_copy(update={"repo_path": "/workspace"})
    result = run_docker(
        ["-i", "-v", f"{data.repo_path}:/workspace", "sandbox-runner:latest", "python3", "-m", "app.main"],
        input=container_input.model_dump_json(), capture_output=True, text=True,
    )
    return SandboxOutput.model_validate_json(result.stdout)

def pick_linter_keys(unhandled_files: list[str]) -> list[str]:
    keys: set[str] = set()
    for f in unhandled_files:
        ext = os.path.splitext(f)[1]
        keys.update(LANGUAGE_LINTERS.get(ext, []))
    return list(keys)

def run_megalinter(repo_path: str, linter_keys: list[str]) -> str:
    report_dir = tempfile.mkdtemp()
    run_docker([
        "-v", f"{repo_path}:/tmp/lint",
        "-v", f"{report_dir}:/reports",
        "-e", "REPORT_OUTPUT_FOLDER=/reports",
        "-e", "SARIF_REPORTER=true",
        "-e", f"ENABLE_LINTERS={','.join(linter_keys)}",
        "-e", "GO_GOLANGCI_LINT_ARGUMENTS=--path-mode=abs",
        "oxsecurity/megalinter-cupcake:latest",
    ])
    return os.path.join(report_dir, "megalinter-report.sarif")

def orchestrate(data: SandboxInput) -> SandboxOutput:
    own_output = run_own_image(data)
    linter_keys = pick_linter_keys(own_output.unhandled_files)
    if not linter_keys:
        return own_output

    sarif_path = run_megalinter(data.repo_path, linter_keys)
    mega_results = translate_sarif(sarif_path, own_output.unhandled_files)

    return SandboxOutput(
        lint_results=own_output.lint_results + mega_results,
        unhandled_files=[],
    )