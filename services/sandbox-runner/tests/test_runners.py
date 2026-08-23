import json
import subprocess

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