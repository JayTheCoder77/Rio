from typing import Protocol

from rio_core.chunking import CodeChunk, chunk_file
from rio_core.models import Symbol


class CodeParser(Protocol):
    """Pluggable source parser used at index time.

    The LangChain splitter is the default. A later tree-sitter
    implementation can chunk on function/class boundaries and fill
    `symbols` without changing the Pinecone metadata layout.
    """

    def chunk(self, path: str, content: str) -> list[CodeChunk]: ...

    def symbols(self, path: str, content: str) -> list[Symbol]: ...


class LangChainParser:
    def chunk(self, path: str, content: str) -> list[CodeChunk]:
        return chunk_file(path, content)

    def symbols(self, path: str, content: str) -> list[Symbol]:
        return []


DEFAULT_PARSER = LangChainParser()
