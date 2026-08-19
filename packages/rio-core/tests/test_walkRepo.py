from rio_core.chunking import walk_repo


def test_walk_repo_skips_env_files_but_keeps_env_example(tmp_path):
    (tmp_path / ".env").write_text("SECRET=shouldneverbepresent")
    (tmp_path / ".env.local").write_text("SECRET=alsoshouldneverbepresent")
    (tmp_path / ".env.example").write_text("SECRET=placeholder")
    (tmp_path / "main.py").write_text("print('hello')")

    results = dict(walk_repo(str(tmp_path)))

    assert ".env" not in results
    assert ".env.local" not in results
    assert ".env.example" in results
    assert "main.py" in results


def test_walk_repo_skips_ignored_directories(tmp_path):
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "dep.js").write_text("module.exports = {}")
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "index.py").write_text("print('real code')")

    results = dict(walk_repo(str(tmp_path)))

    assert not any("node_modules" in path for path in results)
    assert any("index.py" in path for path in results)


def test_walk_repo_skips_binary_files(tmp_path):
    (tmp_path / "image.bin").write_bytes(b"\xff\xfe\x00\x01binarydata")
    (tmp_path / "readme.txt").write_text("plain text content")

    results = dict(walk_repo(str(tmp_path)))

    assert "image.bin" not in results
    assert "readme.txt" in results


def test_walk_repo_respects_max_file_bytes(tmp_path):
    (tmp_path / "small.py").write_text("print('hi')")
    (tmp_path / "huge.py").write_text("x" * 1000)

    results = dict(walk_repo(str(tmp_path), max_file_bytes=500))

    assert "small.py" in results
    assert "huge.py" not in results


def test_walk_repo_empty_dir_returns_empty(tmp_path):
    assert walk_repo(str(tmp_path)) == []


def test_walk_repo_returns_relative_paths(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "index.py").write_text("print('x')")

    paths = [p for p, _ in walk_repo(str(tmp_path))]
    assert paths == ["src/index.py"]
