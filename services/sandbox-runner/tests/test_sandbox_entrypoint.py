import io

from app import sandbox_entrypoint
from rio_core.sandbox import LintResult, SandboxInput, SandboxOutput


class TestSandboxEntrypoint:
    def test_main_combines_ruff_and_eslint_and_tracks_unhandled(self, monkeypatch):
        input_json = SandboxInput(
            repo_path="/repo", changed_files=["a.py", "b.js", "main.go"]
        ).model_dump_json()

        monkeypatch.setattr("sys.stdin", io.StringIO(input_json))
        monkeypatch.setattr(
            "app.sandbox_entrypoint.run_ruff",
            lambda repo_path, files: [LintResult(file="a.py", line=1, rule_id="E1", message="m", tool="ruff")],
        )
        monkeypatch.setattr(
            "app.sandbox_entrypoint.run_eslint",
            lambda repo_path, files: [LintResult(file="b.js", line=2, rule_id="E2", message="m", tool="eslint")],
        )

        out = io.StringIO()
        monkeypatch.setattr("sys.stdout", out)

        sandbox_entrypoint.main()

        output = SandboxOutput.model_validate_json(out.getvalue())
        assert [lr.tool for lr in output.lint_results] == ["ruff", "eslint"]
        assert output.unhandled_files == ["main.go"]

    def test_main_handles_only_changed_py_files(self, monkeypatch):
        input_json = SandboxInput(
            repo_path="/repo", changed_files=["a.py"]
        ).model_dump_json()

        monkeypatch.setattr("sys.stdin", io.StringIO(input_json))
        seen = {}

        def fake_ruff(repo_path, files):
            seen["py"] = list(files)
            return []

        monkeypatch.setattr("app.sandbox_entrypoint.run_ruff", fake_ruff)
        monkeypatch.setattr(
            "app.sandbox_entrypoint.run_eslint",
            lambda repo_path, files: [],
        )

        out = io.StringIO()
        monkeypatch.setattr("sys.stdout", out)
        sandbox_entrypoint.main()
        assert seen["py"] == ["a.py"]