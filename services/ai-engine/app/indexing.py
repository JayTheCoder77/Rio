import os
from itertools import batched

from dotenv import load_dotenv
from langchain_nomic import NomicEmbeddings
from pinecone import Pinecone
from rio_core.chunking import CodeChunk
from rio_core.parser import DEFAULT_PARSER, CodeParser

from app.knowledge.store import upsert_issue_index, upsert_pr_index
from app.state import KnowledgeDoc

load_dotenv()

# Clients are constructed lazily on first use. `Pinecone.Index(...)` makes a
# live control-plane call to resolve the index host, so importing this module
# must not require Pinecone credentials or network access (CI has neither).
pc: Pinecone | None = None
index: object | None = None
embeddings: NomicEmbeddings | None = None


def _ensure_clients() -> None:
    global pc, index, embeddings
    if index is None:
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        index = pc.Index(os.getenv("PINECONE_INDEX_NAME"))
    if embeddings is None:
        # Reads NOMIC_API_KEY from the environment automatically. Was
        # OllamaEmbeddings — Ollama is a local model runner with nowhere to
        # live on a free-tier host. nomic-embed-text-v1.5's hosted API is a
        # drop-in swap: same model family, same default 768-dim output, so
        # the existing Pinecone index (already sized for 768) needs no change.
        embeddings = NomicEmbeddings(model="nomic-embed-text-v1.5")


def get_embeddings() -> NomicEmbeddings:
    _ensure_clients()
    return embeddings


def get_index():
    _ensure_clients()
    return index


BATCH_SIZE = 100
TEXT_METADATA_CAP = 8000


def index_repo(
    files: list[tuple[str, str]],
    repo_id: str,
    parser: CodeParser | None = None,
) -> int:
    """Chunks every (path, content) pair, embeds via Nomic, upserts to
    Pinecone under namespace=repo_id. Returns count of chunks upserted.

    Takes files directly rather than a disk path — the caller (the worker)
    runs in a separate container from ai-engine, so a local path on its
    filesystem is meaningless here; see IndexRepoRequest in app/state.py."""
    parser = parser or DEFAULT_PARSER
    all_chunks: list[tuple[CodeChunk, list[str]]] = []
    for path, content in files:
        symbol_names = [s.name for s in parser.symbols(path, content)]
        for chunk in parser.chunk(path, content):
            all_chunks.append((chunk, symbol_names))

    for batch in batched(all_chunks, BATCH_SIZE):
        texts = [chunk.text for chunk, _ in batch]
        vectors = get_embeddings().embed_documents(texts)

        to_upsert = []
        for (chunk, symbol_names), vector in zip(batch, vectors):
            vector_id = f"{chunk.file_path}:{chunk.start_line}-{chunk.end_line}"
            metadata = {
                "file_path": chunk.file_path,
                "start_line": chunk.start_line,
                "end_line": chunk.end_line,
                "text": chunk.text,
                "kind": "code",
            }
            if symbol_names:
                metadata["symbols"] = symbol_names
            to_upsert.append({
                "id": vector_id,
                "values": vector,
                "metadata": metadata,
            })

        get_index().upsert(vectors=to_upsert, namespace=repo_id)

    return len(all_chunks)


def index_knowledge(repo_id: str, documents: list[KnowledgeDoc]) -> int:
    """Embed PR/issue documents and upsert Postgres + Pinecone. Best-effort
    on the Postgres side — a missing table must not fail indexing."""
    if not documents:
        return 0

    texts = []
    for doc in documents:
        blob = f"{doc.title}\n{doc.body}".strip()
        texts.append(blob[:TEXT_METADATA_CAP] or doc.title)

    vectors = get_embeddings().embed_documents(texts)
    to_upsert = []
    for doc, vector, text in zip(documents, vectors, texts):
        if doc.kind == "pr":
            upsert_pr_index(repo_id, doc.number, doc.title, doc.body, doc.head_sha)
            vector_id = f"pr:{doc.number}"
        else:
            upsert_issue_index(repo_id, doc.number, doc.title, doc.body, doc.state)
            vector_id = f"issue:{doc.number}"
        to_upsert.append({
            "id": vector_id,
            "values": vector,
            "metadata": {
                "kind": doc.kind,
                "number": doc.number,
                "title": doc.title,
                "text": text,
            },
        })

    get_index().upsert(vectors=to_upsert, namespace=repo_id)
    return len(to_upsert)
