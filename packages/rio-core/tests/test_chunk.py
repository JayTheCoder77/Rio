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
