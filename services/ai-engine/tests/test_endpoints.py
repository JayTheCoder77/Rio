from types import SimpleNamespace

import pytest
from app.main import app
from app.nodes import ProviderCredentialError
from app.state import LlmCredential
from fastapi.testclient import TestClient

CREDENTIAL = LlmCredential(provider="openrouter", api_key="sk-test", model="m")
DIFF = (
    "diff --git a/f.py b/f.py\n"
    "--- a/f.py\n"
    "+++ b/f.py\n"
    "@@ -1 +1,2 @@\n"
    " x\n"
    "+y\n"
)


@pytest.fixture(scope="module")
def client():
    # The app's lifespan calls mcp.session_manager.run(), which may only be
    # entered once per instance — so one TestClient for the whole module.
    with TestClient(app) as c:
        yield c


def override_user(user_id):
    from app import main as m
    from app.auth import get_current_user, require_current_user

    m.app.dependency_overrides[get_current_user] = lambda: user_id
    m.app.dependency_overrides[require_current_user] = lambda: user_id


def override_internal(is_internal):
    from app import main as m
    from app.auth import verify_internal_service_token

    m.app.dependency_overrides[verify_internal_service_token] = lambda: is_internal


def override_credential(monkeypatch, credential, capture=None):
    from app import main as m

    # `get_user_llm_credential` is called directly in the endpoint body (not
    # via Depends), so it can't be replaced through dependency_overrides.
    def fake(user_id):
        if capture is not None:
            capture.append(user_id)
        return credential

    monkeypatch.setattr(m, "get_user_llm_credential", fake)


@pytest.fixture(autouse=True)
def _clear_overrides():
    from app.main import app

    yield
    app.dependency_overrides.clear()


def test_health(client):
    assert client.get("/v1/health").json() == {"status": "ok"}


class TestMe:
    def test_valid_key_returns_user_id(self, client, monkeypatch):
        override_user("u-1")
        assert client.get("/v1/me").json() == {"user_id": "u-1"}

    def test_invalid_key_401(self, client):
        assert client.get("/v1/me").status_code == 401


class TestReview:
    def test_no_auth_401(self, client):
        override_internal(False)
        assert client.post("/v1/review", json={"diff": DIFF}).status_code == 401

    def test_internal_token_without_user_id_401(self, client):
        override_internal(True)
        resp = client.post("/v1/review", json={"diff": DIFF})
        assert resp.status_code == 401

    def test_internal_token_with_on_behalf_user_id_uses_it(self, client, monkeypatch):
        override_internal(True)
        seen = []
        override_credential(monkeypatch, CREDENTIAL, capture=seen)

        from app import main as m

        monkeypatch.setattr(
            m,
            "review_graph",
            SimpleNamespace(invoke=lambda state: {"diff": DIFF}),
        )

        resp = client.post(
            "/v1/review",
            json={"diff": DIFF, "on_behalf_of_user_id": "u-42"},
        )
        assert resp.status_code == 200
        # The internal service token alone can't impersonate — the resolved
        # user id came from on_behalf_of_user_id and powered the credential
        # lookup. (main.py strips on_behalf_of_user_id before the graph runs.)
        assert seen == ["u-42"]

    def test_internal_token_with_on_behalf_user_but_no_credential_412(self, client, monkeypatch):
        override_internal(True)
        override_credential(monkeypatch, None)
        resp = client.post(
            "/v1/review",
            json={"diff": DIFF, "on_behalf_of_user_id": "u-42"},
        )
        assert resp.status_code == 412

    def test_user_key_no_credential_412(self, client, monkeypatch):
        override_user("u-1")
        override_internal(False)
        override_credential(monkeypatch, None)
        resp = client.post("/v1/review", json={"diff": DIFF})
        assert resp.status_code == 412
        assert "No LLM provider configured" in resp.json()["detail"]

    def test_provider_rejection_422(self, client, monkeypatch):
        override_user("u-1")
        override_internal(False)
        override_credential(monkeypatch, CREDENTIAL)

        from app import main as m

        def boom(state):
            raise ProviderCredentialError("OpenRouter could not find the model 'foo'.")

        monkeypatch.setattr(m, "review_graph", SimpleNamespace(invoke=boom))
        resp = client.post("/v1/review", json={"diff": DIFF})
        assert resp.status_code == 422
        assert "could not find the model" in resp.json()["detail"]

    def test_diff_too_large_422(self, client, monkeypatch):
        override_user("u-1")
        override_internal(False)
        override_credential(monkeypatch, CREDENTIAL)

        # Run the real graph (no review_graph mock): ingest() raises
        # DiffTooLargeError before any node touches the network.
        from app import nodes

        monkeypatch.setattr(nodes, "MAX_DIFF_CHARS", 100)

        big_diff = DIFF + "+" + "a" * 500
        resp = client.post("/v1/review", json={"diff": big_diff})
        assert resp.status_code == 422
        assert "diff too large" in resp.json()["detail"]
        assert "MAX_DIFF_CHARS" in resp.json()["detail"]

    def test_happy_path_returns_findings_and_strips_credential(self, client, monkeypatch):
        override_user("u-1")
        override_internal(False)
        override_credential(monkeypatch, CREDENTIAL)

        from app import main as m

        def fake_invoke(state):
            return {
                "diff": state.diff,
                "findings": [
                    {
                        "file": "f.py",
                        "line": 2,
                        "severity": "warning",
                        "message": "msg",
                        "rationale": "why",
                    }
                ],
            }

        monkeypatch.setattr(m, "review_graph", SimpleNamespace(invoke=fake_invoke))
        resp = client.post("/v1/review", json={"diff": DIFF})
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["findings"]) == 1
        assert body["findings"][0]["message"] == "msg"
        # The provider credential is never echoed — the field is present but
        # always nulled before serialization (main.py).
        assert body["llm_credential"] is None
        assert body["on_behalf_of_user_id"] is None


class TestIndex:
    def test_index_endpoint_mocked(self, client, monkeypatch):
        from app import main as m

        monkeypatch.setattr(m, "index_repo", lambda files, repo_id: 42)
        resp = client.post(
            "/v1/index/repo",
            json={"files": [{"path": "f.py", "content": "x = 1\\n"}], "repo_id": "repo-1"},
        )
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok", "chunks_indexed": 42}
