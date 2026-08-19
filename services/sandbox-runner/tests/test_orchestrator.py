import subprocess

from app.orchestrator import orchestrate, pick_linter_keys, run_docker
from rio_core.sandbox import SandboxInput, SandboxOutput


class TestPickLinterKeys:
    def test_maps_known_extensions(self):
        keys = pick_linter_keys(["main.go", "util.go"])
        assert set(keys) == {"GO_GOLANGCI_LINT", "GO_REVIVE"}

    def test_unknown_extension_returns_nothing(self):
        assert pick_linter_keys(["app.py"]) == []

    def test_empty_returns_nothing(self):
        assert pick_linter_keys([]) == []


class TestRunDocker:
    def test_normal_run_passes_args(self, monkeypatch):
        captured = {}

        def fake_run(cmd, **kwargs):
            captured["cmd"] = cmd
            return subprocess.CompletedProcess(cmd, 0, stdout="out", stderr="")

        monkeypatch.setattr("app.orchestrator.subprocess.run", fake_run)
        result = run_docker(["-i", "-v", "/x:/workspace", "image:tag"])
        assert result.stdout == "out"
        assert "docker" in captured["cmd"][0]
        assert "--rm" in captured["cmd"]
        assert "--name" in captured["cmd"]

    def test_timeout_kills_container_and_reraises(self, monkeypatch):
        calls = []

        def fake_run(cmd, **kwargs):
            calls.append(cmd)
            if "kill" in cmd:
                return subprocess.CompletedProcess(cmd, 0)
            raise subprocess.TimeoutExpired(cmd, timeout=120)

        monkeypatch.setattr("app.orchestrator.subprocess.run", fake_run)
        try:
            run_docker(["image:tag"])
        except subprocess.TimeoutExpired:
            pass
        else:
            raise AssertionError("expected TimeoutExpired to propagate")
        assert any("kill" in c for c in calls)


class TestOrchestrate:
    def test_no_unhandled_files_skips_megalinter(self, monkeypatch):
        own = SandboxOutput(
            lint_results=[],
            unhandled_files=[],
        )
        monkeypatch.setattr("app.orchestrator.run_own_image", lambda data: own)
        monkeypatch.setattr("app.orchestrator.run_megalinter", lambda *a, **k: (_ for _ in ()).throw(AssertionError("should not run")))
        out = orchestrate(SandboxInput(repo_path="/tmp/x", changed_files=["a.py"]))
        assert out.unhandled_files == []

    def test_merges_own_and_megalinter_results(self, monkeypatch):
        from rio_core.sandbox import LintResult

        own = SandboxOutput(
            lint_results=[LintResult(file="a.py", line=1, rule_id="E1", message="m", tool="ruff")],
            unhandled_files=["main.go"],
        )
        mega = [LintResult(file="main.go", line=2, rule_id="R1", message="m", tool="revive")]

        monkeypatch.setattr("app.orchestrator.run_own_image", lambda data: own)
        monkeypatch.setattr(
            "app.orchestrator.run_megalinter",
            lambda repo_path, keys: "/tmp/report.sarif",
        )
        monkeypatch.setattr(
            "app.orchestrator.translate_sarif",
            lambda path, unhandled: mega,
        )

        out = orchestrate(SandboxInput(repo_path="/tmp/x", changed_files=["a.py", "main.go"]))
        assert [lr.tool for lr in out.lint_results] == ["ruff", "revive"]
        assert out.unhandled_files == []