from types import SimpleNamespace

import pytest


@pytest.fixture
def fake_index() -> SimpleNamespace:
    calls: list[tuple[list, str]] = []

    class _FakeIndex:
        def upsert(self, *, vectors, namespace):
            calls.append((vectors, namespace))

    fake = _FakeIndex()
    fake.calls = calls
    return fake


@pytest.fixture
def stub_embeddings(monkeypatch: pytest.MonkeyPatch) -> None:
    # Import lazily so the module-level Pinecone client only constructs inside
    # the test (env vars are defaulted in conftest for CI).
    from app import indexing

    monkeypatch.setattr(
        indexing,
        "embeddings",
        SimpleNamespace(embed_documents=lambda texts: [[0.1] * 768 for _ in texts]),
    )


def test_index_repo_upserts_chunks(monkeypatch, fake_index, stub_embeddings):
    from app import indexing

    monkeypatch.setattr(indexing, "index", fake_index)

    count = indexing.index_repo([("hello.py", "def hello():\n    return 'world'\n")], "repo-1")

    assert count == 1
    (vectors, namespace) = fake_index.calls[0]
    assert namespace == "repo-1"
    assert vectors[0]["values"] == [0.1] * 768
    assert vectors[0]["metadata"]["file_path"] == "hello.py"
    assert vectors[0]["metadata"]["text"]
    assert vectors[0]["id"].startswith("hello.py:")


def test_index_repo_batches_oversized_repos(monkeypatch, fake_index, stub_embeddings):
    from app import indexing

    monkeypatch.setattr(indexing, "index", fake_index)

    # ~172KB of source -> well over the BATCH_SIZE=100 chunk boundary, but
    # below the worker's 500KB max_file_bytes so it is actually shipped.
    content = "\n".join(f"line{i:05d}: " + "a" * 30 for i in range(4000))
    count = indexing.index_repo([("big.py", content)], "repo-2")

    assert count > 100
    assert len(fake_index.calls) > 1
    total = 0
    for vectors, namespace in fake_index.calls:
        assert namespace == "repo-2"
        assert len(vectors) <= 100
        total += len(vectors)
    assert total == count


def test_index_repo_accepts_files_pre_filtered_by_worker(monkeypatch, fake_index, stub_embeddings):
    from app import indexing

    monkeypatch.setattr(indexing, "index", fake_index)

    # `walkRepo` in the worker filters .env files before sending this request.
    count = indexing.index_repo([("app.py", "print('hi')\n")], "repo-3")

    assert count == 1
    assert fake_index.calls[0][1] == "repo-3"
    assert fake_index.calls[0][0][0]["metadata"]["file_path"] == "app.py"


def test_index_endpoint(monkeypatch, fake_index, stub_embeddings):
    # Called as a plain function rather than through TestClient: the mcp
    # lifespan (mcp.session_manager.run) only tolerates one run per process,
    # and test_endpoints.py already owns that single run via its module-scoped
    # client. The HTTP layer adds nothing this test needs — the endpoint is
    # just `index_repo(...)` with a pydantic body.
    from app import indexing
    from app.main import index_endpoint
    from app.state import IndexRepoRequest

    monkeypatch.setattr(indexing, "index", fake_index)

    result = index_endpoint(
        IndexRepoRequest(
            files=[{"path": "hello.py", "content": "def hello():\n    return 'world'\n"}],
            repo_id="repo-4",
        )
    )

    assert result == {"status": "ok", "chunks_indexed": 1}
