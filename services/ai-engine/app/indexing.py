import os
from itertools import batched

from dotenv import load_dotenv
from langchain_nomic import NomicEmbeddings
from pinecone import Pinecone
from rio_core.chunking import CodeChunk, chunk_file

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


BATCH_SIZE=100

def index_repo(files : list[tuple[str,str]] , repo_id : str) -> int:
    """Chunks every (path, content) pair, embeds via Ollama, upserts to
    Pinecone under namespace=repo_id. Returns count of chunks upserted.

    Takes files directly rather than a disk path — the caller (the worker)
    runs in a separate container from ai-engine, so a local path on its
    filesystem is meaningless here; see IndexRepoRequest in app/state.py."""
    all_chunks : list[CodeChunk] = []
    for path,content in files:
        all_chunks.extend(chunk_file(path , content))

    for batch in batched(all_chunks , BATCH_SIZE):
        texts = [chunk.text for chunk in batch]
        vectors = get_embeddings().embed_documents(texts)

        to_upsert = []
        for chunk , vector in zip(batch , vectors):
            vector_id = f"{chunk.file_path}:{chunk.start_line}-{chunk.end_line}"
            to_upsert.append({
                "id" : vector_id,
                "values" : vector,
                "metadata" : {
                    "file_path" : chunk.file_path,
                    "start_line" : chunk.start_line,
                    "end_line" : chunk.end_line,
                    "text" : chunk.text
                }
            })

        get_index().upsert(vectors=to_upsert , namespace=repo_id)
    
    return len(all_chunks)