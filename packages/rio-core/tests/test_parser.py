from rio_core.parser import LangChainParser


def test_langchain_parser_chunks_like_chunk_file():
    parser = LangChainParser()
    content = "def foo():\n    return 1\n"
    chunks = parser.chunk("a.py", content)
    assert len(chunks) == 1
    assert chunks[0].file_path == "a.py"
    assert chunks[0].start_line == 1
    assert "def foo" in chunks[0].text
    assert parser.symbols("a.py", content) == []
