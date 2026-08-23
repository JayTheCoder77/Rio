import json
import subprocess

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def fake_completed(stdout: str, returncode: int = 0):
    return subprocess.CompletedProcess(["x"], returncode, stdout=stdout, stderr="")


def test_health():
    res = client.get("/v1/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_verify_lints_python_file(monkeypatch):
    def fake_run(cmd, **kwargs):
        assert cmd[0] == "ruff"
        # main.py writes shipped files under a fresh temp dir per request,
        # so the real path isn't known ahead of time — match on the file's
        # basename instead of asserting an exact path.
        assert cmd[-1].endswith("bad.py")
        return fake_completed(json.dumps([
            {
                "filename": cmd[-1],
                "location": {"row": 1},
                "code": "F401",
                "message": "os imported but unused",
            }
        ]))

    monkeypatch.setattr("app.ruff_runner.subprocess.run", fake_run)

    res = client.post("/v1/verify", json={
        "files": [{"path": "bad.py", "content": "import os\n"}],
    })
    assert res.status_code == 200
    body = res.json()
    assert body["lint_results"] == [
        {"file": "bad.py", "line": 1, "rule_id": "F401", "message": "os imported but unused", "tool": "ruff"}
    ]
    assert body["unhandled_files"] == []


def test_verify_reports_non_python_files_as_unhandled():
    res = client.post("/v1/verify", json={
        "files": [{"path": "app.js", "content": "const x = 1;\n"}],
    })
    assert res.status_code == 200
    body = res.json()
    assert body["lint_results"] == []
    assert body["unhandled_files"] == ["app.js"]


def test_verify_empty_files_returns_empty():
    res = client.post("/v1/verify", json={"files": []})
    assert res.status_code == 200
    assert res.json() == {"lint_results": [], "unhandled_files": []}
