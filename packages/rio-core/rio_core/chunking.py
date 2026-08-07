import os
from pathlib import Path

from langchain_text_splitters import Language, RecursiveCharacterTextSplitter
from pydantic import BaseModel


class CodeChunk(BaseModel):
    file_path : str
    start_line : int
    end_line : int
    text : str

EXTENSION_TO_LANGUAGE : dict[str , Language] = {
    ".py" : Language.PYTHON,
    ".go": Language.GO,
    ".rs": Language.RUST,
    ".ts": Language.TS, ".tsx": Language.TS,
    ".js": Language.JS, ".jsx": Language.JS
}

DIRS_TO_IGNORE = [
    ".git" , "node_modules" , "dist" , "build" , ".venv" , "__pycache__" , ".next" , "target" , ".turbo"
]

# Any filename starting with one of these prefixes is skipped — covers .env,
# .env.local, .env.production, etc. .env.example is explicitly allowlisted
# since it holds no real secrets and is meant to be committed/read.
ENV_FILENAME_PREFIXES = (".env",)
ENV_FILENAME_ALLOWLIST = {".env.example"}

def _is_ignored_filename(filename: str) -> bool:
    if filename in ENV_FILENAME_ALLOWLIST:
        return False
    return filename.startswith(ENV_FILENAME_PREFIXES)

def chunk_file(file_path:str , content : str , chunk_size : int = 1000 , overlap : int = 200) -> list[CodeChunk]:
    extension = Path(file_path).suffix
    chunks : list[CodeChunk] = []
    if not content.strip():
        return chunks
    if extension in EXTENSION_TO_LANGUAGE:
        splitter = RecursiveCharacterTextSplitter.from_language(
            language=EXTENSION_TO_LANGUAGE[extension], chunk_size=chunk_size, chunk_overlap=overlap , add_start_index=True
        )
        docs = splitter.create_documents([content])
    else:
        splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=overlap , add_start_index=True)
        docs = splitter.create_documents([content])
    
    for doc in docs:
        ioffset = doc.metadata.get("start_index")
        sindex = content[:ioffset].count("\n") + 1
        eoffset = ioffset + len(doc.page_content)
        eindex = content[:eoffset].count("\n") + 1
    
        chunks.append(CodeChunk(
            file_path=file_path,
            start_line=sindex,
            end_line=eindex,
            text=doc.page_content
        ))

    return chunks

def walk_repo(repo_path : str , max_file_bytes : int = 500_000) -> list[tuple[str,str]]:
    result : list[tuple[str,str]] = []
    for dirpath , dirnames , filenames in os.walk(repo_path):
        dirnames[:] = [d for d in dirnames if d not in DIRS_TO_IGNORE]

        for filename in filenames:
            if _is_ignored_filename(filename):
                continue

            full_path = os.path.join(dirpath , filename)
            try:
                size = os.path.getsize(full_path)
                if size < max_file_bytes:
                        with open(full_path, "r", encoding="utf-8" , errors="strict") as f:
                            content = f.read()
                            relative_path = os.path.relpath(full_path, repo_path)
                            result.append((relative_path , content))
            except UnicodeDecodeError as e:
                print(f"UnicodeDecodeError in {filename}: {e}")

    return result
                 