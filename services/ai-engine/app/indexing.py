import os
from itertools import batched

from dotenv import load_dotenv
from langchain_ollama import OllamaEmbeddings
from pinecone import Pinecone
from rio_core.chunking import CodeChunk, chunk_file, walk_repo

load_dotenv()

# Clients are constructed lazily on first use. `Pinecone.Index(...)` makes a
# live control-plane call to resolve the index host, so importing this module
# must not require Pinecone credentials or network access (CI has neither).
pc: Pinecone | None = None
index: object | None = None
embeddings: OllamaEmbeddings | None = None


def _ensure_clients() -> None:
    global pc, index, embeddings
    if index is None:
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        index = pc.Index(os.getenv("PINECONE_INDEX_NAME"))
    if embeddings is None:
        embeddings = OllamaEmbeddings(model="nomic-embed-text")


def get_embeddings() -> OllamaEmbeddings:
    _ensure_clients()
    return embeddings


def get_index():
    _ensure_clients()
    return index


BATCH_SIZE=100

def index_repo(repo_path : str , repo_id : str) -> int:
    """Walks repo_path, chunks every file, embeds via Ollama, upserts to
    Pinecone under namespace=repo_id. Returns count of chunks upserted."""
    all_chunks : list[CodeChunk] = []
    for path,content in walk_repo(repo_path):
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
    
