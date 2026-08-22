import httpx
import pytest
from app.nodes import (
    ProviderCredentialError,
    build_llm,
    enrich,
    ingest,
    review,
    verify,
)
from app.state import LlmCredential, ReviewState
from app.utils.utils import format_context
from openai import APIConnectionError, APIStatusError
from rio_core.config import RioConfig
from rio_core.models import Finding
from rio_core.sandbox import LintResult


def make_status_error(status_code: int) -> APIStatusError:
    request = httpx.Request("POST", "http://example.com")
    response = httpx.Response(status_code, request=request)
    return APIStatusError("provider boom", response=response, body=None)


def make_connection_error() -> APIConnectionError:
    return APIConnectionError(request=httpx.Request("POST", "http://example.com"))


class FakeStructuredLLM:
    def __init__(self, outcome):
        self.outcome = outcome

    def invoke(self, messages):
        if isinstance(self.outcome, BaseException):
            raise self.outcome
        return self.outcome


class FakeLLM:
    def __init__(self, outcome):
        self.structured = FakeStructuredLLM(outcome)

    def with_structured_output(self, schema, method="function_calling"):
        assert schema.__name__ == "FindingsResponse"
        assert method == "function_calling"
        return self.structured


def patch_llm(monkeypatch: pytest.MonkeyPatch, outcome):
    monkeypatch.setattr("app.nodes.build_llm", lambda cred: FakeLLM(outcome))


CRED = LlmCredential(provider="groq", api_key="sk-test", model="llama-3.1-8b")


class TestIngest:
    def test_parses_diff_and_applies_ignore_paths(self):
        state = ReviewState(
            diff=(
                "diff --git a/src/a.py b/src/a.py\n"
                "--- a/src/a.py\n"
                "+++ b/src/a.py\n"
                "@@ -1 +1,2 @@\n"
                " x\n"
                "+y\n"
            ),
            config=RioConfig(ignore_paths=["src/*"]),
        )
        out = ingest(state)
        assert out["parsed_files"] == []

    def test_keeps_files_not_matching_ignore(self):
        state = ReviewState(
            diff=(
                "diff --git a/tests/a.py b/tests/a.py\n"
                "--- a/tests/a.py\n"
                "+++ b/tests/a.py\n"
                "@@ -1 +1,2 @@\n"
                " x\n"
                "+y\n"
            ),
            config=RioConfig(ignore_paths=["src/*"]),
        )
        out = ingest(state)
        assert [pf.path for pf in out["parsed_files"]] == ["tests/a.py"]

    def test_raises_on_oversized_diff(self, monkeypatch):
        from app.nodes import DiffTooLargeError

        monkeypatch.setattr("app.nodes.MAX_DIFF_CHARS", 40_000)
        big = "a" * 40_001
        with pytest.raises(DiffTooLargeError, match="diff too large"):
            ingest(ReviewState(diff=big))


class TestVerify:
    def _state(self, findings, lint_results=None):
        state = ReviewState(
            diff="",
            parsed_files=[],
            findings=findings,
            lint_results=lint_results or [],
        )
        # Build a valid-lines map matching a one-line diff.
        from rio_core.models import ParsedFile

        state.parsed_files = [ParsedFile(path="f.py", added_lines={5: "x\n"})]
        return state

    def test_drops_findings_on_lines_not_added_in_diff(self):
        state = self._state(
            [Finding(file="f.py", line=99, severity="critical", message="m", rationale="r")]
        )
        assert verify(state)["findings"] == []

    def test_keeps_critical_and_warning_without_lint_corroboration(self):
        findings = [
            Finding(file="f.py", line=5, severity="critical", message="m", rationale="r"),
            Finding(file="f.py", line=5, severity="warning", message="m", rationale="r"),
        ]
        assert len(verify(self._state(findings))["findings"]) == 2

    def test_info_requires_lint_corroboration(self):
        lone = [Finding(file="f.py", line=5, severity="info", message="m", rationale="r")]
        assert verify(self._state(lone))["findings"] == []

        corroborated = [
            Finding(file="f.py", line=5, severity="info", message="m", rationale="r")
        ]
        lint = [LintResult(file="f.py", line=5, rule_id="X", message="m", tool="ruff")]
        out = verify(self._state(corroborated, lint))["findings"]
        assert len(out) == 1


class TestBuildLlm:
    def test_groq_base_url_and_model(self):
        llm = build_llm(CRED)
        assert llm.openai_api_base == "https://api.groq.com/openai/v1"
        assert llm.model_name == "llama-3.1-8b"
        assert llm.temperature == 0
        assert llm.openai_api_key  # api key wired through

    def test_openrouter_base_url(self):
        llm = build_llm(
            LlmCredential(provider="openrouter", api_key="k", model="google/gemma-4-26b-a4b-it:free")
        )
        assert llm.openai_api_base == "https://openrouter.ai/api/v1"

    def test_unknown_provider_raises(self):
        bad = LlmCredential(provider="openrouter", api_key="k", model="m")  # type: ignore[assignment]
        bad.provider = "not-a-provider"
        with pytest.raises(KeyError):
            build_llm(bad)


class TestFormatContext:
    def test_empty(self):
        assert format_context([]) == "No related context was retrieved."

    def test_renders_chunks(self):
        from rio_core.models import RetrievedChunk

        chunks = [RetrievedChunk(file_path="a.py", start_line=1, end_line=2, text="code", score=0.5)]
        out = format_context(chunks)
        assert "### a.py (lines 1-2)" in out
        assert "code" in out


class TestReview:
    def _state(self, credential=CRED):
        return ReviewState(
            diff="diff --git a/f.py b/f.py\n--- a/f.py\n+++ b/f.py\n@@ -1 +1,2 @@\n x\n+y\n",
            llm_credential=credential,
        )

    def test_no_credential_raises_value_error(self):
        with pytest.raises(ValueError, match="No LLM provider credential"):
            review(ReviewState(diff="x"))

    def test_happy_path_filters_and_caps(self, monkeypatch):
        from app.nodes import FindingsResponse

        response = FindingsResponse(
            findings=[
                Finding(file="f.py", line=2, severity="info", message="info one", rationale="r"),
                Finding(file="f.py", line=2, severity="critical", message="crit one", rationale="r"),
                Finding(file="f.py", line=2, severity="warning", message="warn one", rationale="r"),
                Finding(file="f.py", line=2, severity="critical", message="crit two", rationale="r"),
            ]
        )
        patch_llm(monkeypatch, response)
        state = self._state()
        state.config = RioConfig(min_severity="info", max_comments_per_pr=2)
        out = review(state)
        assert [f.message for f in out["findings"]] == ["crit one", "crit two"]

    def test_min_severity_drops_lower(self, monkeypatch):
        from app.nodes import FindingsResponse

        response = FindingsResponse(
            findings=[
                Finding(file="f.py", line=2, severity="info", message="info", rationale="r"),
                Finding(file="f.py", line=2, severity="warning", message="warn", rationale="r"),
            ]
        )
        patch_llm(monkeypatch, response)
        state = self._state()
        state.config = RioConfig(min_severity="warning")
        assert [f.message for f in review(state)["findings"]] == ["warn"]

    @pytest.mark.parametrize("code", [401, 403])
    def test_invalid_key_maps_to_provider_error(self, monkeypatch, code):
        patch_llm(monkeypatch, make_status_error(code))
        with pytest.raises(ProviderCredentialError, match="rejected the configured API key"):
            review(self._state())

    def test_404_maps_to_model_name_error(self, monkeypatch):
        patch_llm(monkeypatch, make_status_error(404))
        with pytest.raises(ProviderCredentialError, match="could not find the model"):
            review(self._state())

    def test_other_status_uses_provider_message(self, monkeypatch):
        patch_llm(monkeypatch, make_status_error(429))
        with pytest.raises(ProviderCredentialError, match="status 429"):
            review(self._state())

    def test_connection_error_maps_to_provider_error(self, monkeypatch):
        patch_llm(monkeypatch, make_connection_error())
        with pytest.raises(ProviderCredentialError, match="Could not reach Groq"):
            review(self._state())

    def test_unparseable_output_maps_to_provider_error(self, monkeypatch):
        # Simulates langchain raising OutputParserException (a ValueError) when
        # the model returns no usable tool call — must be a clean 4xx, not a 500.
        patch_llm(monkeypatch, ValueError("Expected but did not find tool call"))
        with pytest.raises(ProviderCredentialError, match="could not be parsed"):
            review(self._state())

    def test_bare_value_error_maps_cleanly(self, monkeypatch):
        # A ValueError() with no message (args=()) used to crash the old handler
        # with IndexError — now it is swallowed into the same clean 4xx.
        patch_llm(monkeypatch, ValueError())
        with pytest.raises(ProviderCredentialError, match="could not be parsed"):
            review(self._state())


class TestEnrich:
    def test_no_repo_id_returns_empty_context(self):
        assert enrich(ReviewState(diff="", repo_id=None)) == {"context": []}

    def test_queries_index_and_skips_same_file(self, monkeypatch):
        from types import SimpleNamespace

        from rio_core.models import ParsedFile

        class FakeMatch:
            def __init__(self, file_path, start, end, text, score):
                self.metadata = {
                    "file_path": file_path,
                    "start_line": start,
                    "end_line": end,
                    "text": text,
                }
                self.score = score

        class FakeIndex:
            def query(self, **kwargs):
                assert kwargs["namespace"] == "repo-1"
                assert kwargs["top_k"] == 3
                return type("R", (), {"matches": [
                    FakeMatch("other.py", 1, 2, "same text", 0.9),
                    FakeMatch("f.py", 1, 2, "self", 0.99),
                ]})()

        # Patch the getters (not bound module names — clients are lazy now).
        monkeypatch.setattr(
            "app.nodes.get_embeddings",
            lambda: SimpleNamespace(embed_query=lambda text: [0.1, 0.2, 0.3]),
        )
        monkeypatch.setattr("app.nodes.get_index", lambda: FakeIndex())

        state = ReviewState(
            diff="",
            repo_id="repo-1",
            parsed_files=[ParsedFile(path="f.py", added_lines={1: "same text\n"})],
        )
        context = enrich(state)["context"]
        assert len(context) == 1
        assert context[0].file_path == "other.py"

    def test_retrieval_failure_degrades_to_empty_context(self, monkeypatch):
        from rio_core.models import ParsedFile

        def boom_embeddings():
            raise RuntimeError("ollama not running")

        monkeypatch.setattr("app.nodes.get_embeddings", boom_embeddings)

        state = ReviewState(
            diff="",
            repo_id="repo-1",
            parsed_files=[ParsedFile(path="f.py", added_lines={1: "same text\n"})],
        )
        assert enrich(state) == {"context": []}
