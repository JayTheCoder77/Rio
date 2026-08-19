import json
import subprocess

from app.eslint_runner import has_eslint_config, run_eslint
from app.ruff_runner import run_ruff


def fake_completed(stdout: str, returncode: int = 0):
    return subprocess.CompletedProcess(["x"], returncode, stdout=stdout, stderr="")


class TestRuffRunner:
    def test_no_py_files_returns_empty(self, tmp_path):
        assert run_ruff(str(tmp_path), []) == []

    def test_parses_ruff_json_and_maps_paths(self, tmp_path, monkeypatch):
        (tmp_path / "bad.py").write_text("import os\n")

        def fake_run(cmd, **kwargs):
            assert cmd[0] == "ruff"
            return fake_completed(json.dumps([
                {
                    "filename": f"{tmp_path}/bad.py",
                    "location": {"row": 2},
                    "code": "F401",
                    "message": "os imported but unused",
                }
            ]))

        monkeypatch.setattr("app.ruff_runner.subprocess.run", fake_run)
        results = run_ruff(str(tmp_path), ["bad.py"])
        assert len(results) == 1
        assert results[0].file == "bad.py"
        assert results[0].line == 2
        assert results[0].rule_id == "F401"
        assert results[0].tool == "ruff"


class TestEslintRunner:
    def test_no_config_returns_empty(self, tmp_path):
        assert run_eslint(str(tmp_path), ["a.js"]) == []

    def test_no_js_files_returns_empty(self, tmp_path):
        (tmp_path / "eslint.config.js").write_text("")
        assert run_eslint(str(tmp_path), []) == []

    def test_parses_eslint_json(self, tmp_path, monkeypatch):
        (tmp_path / "eslint.config.js").write_text("export default []")
        (tmp_path / "a.js").write_text("const x = 1;\n")

        def fake_run(cmd, **kwargs):
            assert cmd[0] == "eslint"
            return fake_completed(json.dumps([
                {
                    "filePath": f"{tmp_path}/a.js",
                    "messages": [
                        {"line": 1, "ruleId": "no-unused-vars", "message": "x is unused"},
                        {"line": 2, "ruleId": None, "message": "parse error"},
                    ],
                }
            ]))

        monkeypatch.setattr("app.eslint_runner.subprocess.run", fake_run)
        results = run_eslint(str(tmp_path), ["a.js"])
        assert len(results) == 2
        assert results[0].rule_id == "no-unused-vars"
        assert results[0].tool == "eslint"
        assert results[1].rule_id == "parse-error"


class TestHasEslintConfig:
    def test_detects_flat_config(self, tmp_path):
        (tmp_path / "eslint.config.mjs").write_text("")
        assert has_eslint_config(str(tmp_path)) is True

    def test_false_when_missing(self, tmp_path):
        assert has_eslint_config(str(tmp_path)) is False