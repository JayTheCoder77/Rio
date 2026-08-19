import httpx
import pytest
import typer
from rio_cli.main import _resolve_diff
from rio_cli.post import _post_review


class TestResolveDiff:
    def test_include_untracked_appends_untracked(self, monkeypatch):
        monkeypatch.setattr(
            "rio_cli.main._try_committed_diff", lambda: "committed-diff\n"
        )
        monkeypatch.setattr(
            "rio_cli.main._try_uncommitted_diff", lambda: "uncommitted-diff\n"
        )
        monkeypatch.setattr("rio_cli.main._get_untracked_diff", lambda: "untracked\n")

        out = _resolve_diff(False, False, False, None, include_untracked=True)
        assert "committed-diff" in out
        assert "uncommitted-diff" in out
        assert "untracked" in out

    def test_include_untracked_all_empty_fails(self, monkeypatch):
        monkeypatch.setattr("rio_cli.main._try_committed_diff", lambda: "")
        monkeypatch.setattr("rio_cli.main._try_uncommitted_diff", lambda: "")
        monkeypatch.setattr("rio_cli.main._get_untracked_diff", lambda: "")

        with pytest.raises(typer.Exit):
            _resolve_diff(False, False, False, None, include_untracked=True)

    def test_hard_modes_use_hard_functions(self, monkeypatch):
        called = {}

        def staged():
            called["staged"] = True
            return "staged-diff\n"

        monkeypatch.setattr("rio_cli.main._get_staged_diff", staged)
        out = _resolve_diff(True, False, False, None, include_untracked=False)
        assert out == "staged-diff\n"
        assert called == {"staged": True}

    def test_diff_file_takes_precedence(self, monkeypatch):
        monkeypatch.setattr("rio_cli.main._get_diff_from_file", lambda p: "file-diff\n")
        out = _resolve_diff(True, False, False, "/tmp/x.diff", include_untracked=False)
        assert out == "file-diff\n"

    def test_default_combines(self, monkeypatch):
        monkeypatch.setattr("rio_cli.main._get_combined_diff", lambda: "combined\n")
        assert _resolve_diff(False, False, False, None, include_untracked=False) == "combined\n"


class FakeResponse:
    def __init__(self, status_code=200, json_data=None, text=""):
        self.status_code = status_code
        self._json = json_data or {}
        self.text = text

    def json(self):
        return self._json


class TestPostReview:
    def _mock_config(self, monkeypatch, key="rio_k", url="http://engine:8000"):
        monkeypatch.setattr("rio_cli.post.get_api_key", lambda: key)
        monkeypatch.setattr("rio_cli.post.get_ai_engine_url", lambda: url)
        monkeypatch.setattr("rio_cli.post.load_rio_config", lambda: type("C", (), {"model_dump": lambda self: {}})())

    def test_no_api_key_fails(self, monkeypatch):
        monkeypatch.setattr("rio_cli.post.get_api_key", lambda: None)
        with pytest.raises(typer.Exit):
            _post_review("diff")

    def test_connect_error_fails(self, monkeypatch):
        self._mock_config(monkeypatch)

        def boom(url, **kwargs):
            raise httpx.ConnectError("down")

        monkeypatch.setattr("rio_cli.post.httpx.post", boom)
        with pytest.raises(typer.Exit):
            _post_review("diff")

    def test_timeout_fails(self, monkeypatch):
        self._mock_config(monkeypatch)

        def boom(url, **kwargs):
            raise httpx.TimeoutException("slow")

        monkeypatch.setattr("rio_cli.post.httpx.post", boom)
        with pytest.raises(typer.Exit):
            _post_review("diff")

    @pytest.mark.parametrize("status", [401, 412, 422])
    def test_error_status_fails_with_detail(self, monkeypatch, status):
        self._mock_config(monkeypatch)

        def fake_post(url, **kwargs):
            return FakeResponse(status, json_data={"detail": f"detail-{status}"})

        monkeypatch.setattr("rio_cli.post.httpx.post", fake_post)
        with pytest.raises(typer.Exit):
            _post_review("diff")

    def test_unknown_status_fails(self, monkeypatch):
        self._mock_config(monkeypatch)
        monkeypatch.setattr(
            "rio_cli.post.httpx.post",
            lambda url, **kwargs: FakeResponse(500, text="boom"),
        )
        with pytest.raises(typer.Exit):
            _post_review("diff")

    def test_success_parses_findings(self, monkeypatch):
        self._mock_config(monkeypatch)
        body = {
            "findings": [
                {
                    "file": "a.py",
                    "line": 3,
                    "severity": "warning",
                    "message": "m",
                    "rationale": "r",
                }
            ]
        }
        monkeypatch.setattr(
            "rio_cli.post.httpx.post",
            lambda url, **kwargs: FakeResponse(200, json_data=body),
        )
        findings = _post_review("diff")
        assert findings[0].file == "a.py"
        assert findings[0].severity == "warning"