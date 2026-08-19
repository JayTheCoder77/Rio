from pathlib import Path

from rio_core.chunking import chunk_file

CODE_FILE = Path(__file__).parent / "code.py"


def test_chunk_file_produces_chunks_with_valid_line_ranges():
    content = CODE_FILE.read_text()
    chunks = chunk_file("code.py", content)

    assert len(chunks) > 0
    for chunk in chunks:
        assert chunk.file_path == "code.py"
        assert chunk.start_line >= 1
        assert chunk.end_line >= chunk.start_line
        assert chunk.text.strip() != ""


def test_chunk_file_empty_content_returns_no_chunks():
    assert chunk_file("empty.py", "") == []
    assert chunk_file("blank.py", "   \n\n  ") == []


def test_chunk_file_line_numbers_match_content():
    # Line ranges must point at the actual text: the slice of content between
    # start_line and end_line should contain the chunk text.
    content = "\n".join(f"line{i}" for i in range(1, 300))
    chunks = chunk_file("big.py", content, chunk_size=100, overlap=20)

    assert len(chunks) > 1
    lines = content.splitlines()
    for chunk in chunks:
        assert chunk.text == "\n".join(lines[chunk.start_line - 1 : chunk.end_line])
        assert chunk.start_line <= chunk.end_line


def test_chunk_file_chunks_cover_entire_content():
    content = "\n".join(f"line{i}" for i in range(1, 300))
    chunks = chunk_file("big.py", content, chunk_size=100, overlap=20)

    covered = set()
    for chunk in chunks:
        covered.update(range(chunk.start_line, chunk.end_line + 1))
    # Overlap may duplicate a few lines, but every line must appear at least once.
    assert covered == set(range(1, 300))


def test_chunk_file_small_content_single_chunk():
    content = "def foo():\n    return 1\n"
    chunks = chunk_file("a.py", content)
    assert len(chunks) == 1
    assert chunks[0].start_line == 1
    assert chunks[0].end_line == 2


def test_chunk_file_unknown_extension_uses_generic_splitter():
    content = "\n".join(f"line{i}" for i in range(1, 50))
    chunks = chunk_file("README.unknown", content, chunk_size=20, overlap=5)
    assert len(chunks) >= 1
    assert all(c.file_path == "README.unknown" for c in chunks)