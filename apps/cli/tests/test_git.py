import subprocess

import pytest
from rio_cli.git import (
    _get_combined_diff,
    _get_committed_diff,
    _get_diff_from_file,
    _get_staged_diff,
    _get_uncommitted_diff,
    _get_untracked_diff,
    _get_untracked_files,
    _try_committed_diff,
    _try_staged_diff,
)


def git(repo, *args):
    return subprocess.run(
        ["git", *args], cwd=repo, capture_output=True, text=True, check=False
    )


@pytest.fixture()
def repo(tmp_path, monkeypatch):
    r = tmp_path / "repo"
    r.mkdir()
    git(r, "init", "-q")
    git(r, "config", "user.email", "t@t.t")
    git(r, "config", "user.name", "T")
    (r / "base.txt").write_text("one\n")
    git(r, "add", ".")
    git(r, "commit", "-qm", "base")
    monkeypatch.chdir(r)
    return r


class TestStaged:
    def test_staged_diff_present(self, repo):
        (repo / "base.txt").write_text("one\ntwo\n")
        git(repo, "add", ".")
        diff = _get_staged_diff()
        assert "+two" in diff

    def test_no_staged_fails(self, repo):
        with pytest.raises(Exception) as e:
            _get_staged_diff()
        assert e.type.__name__ == "Exit"

    def test_try_staged_empty_when_nothing(self, repo):
        assert _try_staged_diff() == ""


class TestUncommitted:
    def test_uncommitted_present(self, repo):
        (repo / "base.txt").write_text("one\nchanged\n")
        assert "+changed" in _get_uncommitted_diff()

    def test_no_uncommitted_fails(self, repo):
        with pytest.raises(Exception) as e:
            _get_uncommitted_diff()
        assert e.type.__name__ == "Exit"


class TestCommitted:
    @pytest.fixture()
    def feature_branch(self, repo):
        git(repo, "checkout", "-qb", "feature")
        (repo / "feature.txt").write_text("new\n")
        git(repo, "add", ".")
        git(repo, "commit", "-qm", "feature work")
        git(repo, "branch", "--set-upstream-to=main", "feature")
        return repo

    def test_committed_diff_needs_upstream(self, repo):
        with pytest.raises(Exception) as e:
            _get_committed_diff()
        assert e.type.__name__ == "Exit"

    def test_try_committed_empty_without_upstream(self, repo):
        assert _try_committed_diff() == ""

    def test_committed_diff_returns_unpushed_work(self, feature_branch):
        diff = _get_committed_diff()
        assert "feature.txt" in diff
        assert "+new" in diff

    def test_combined_includes_committed_and_uncommitted(self, feature_branch):
        (feature_branch / "base.txt").write_text("one\nwip\n")
        combined = _get_combined_diff()
        assert "feature.txt" in combined
        assert "+wip" in combined


class TestUntracked:
    def test_untracked_files_list(self, repo):
        (repo / "new.txt").write_text("fresh\n")
        assert _get_untracked_files() == ["new.txt"]

    def test_untracked_diff_synthetic(self, repo):
        (repo / "new.txt").write_text("fresh\n")
        diff = _get_untracked_diff()
        assert "new.txt" in diff
        assert "+fresh" in diff


class TestDiffFromFile:
    def test_reads_file(self, tmp_path):
        p = tmp_path / "d.diff"
        p.write_text("content")
        assert _get_diff_from_file(str(p)) == "content"

    def test_missing_file_fails(self, tmp_path):
        with pytest.raises(Exception) as e:
            _get_diff_from_file(str(tmp_path / "nope.diff"))
        assert e.type.__name__ == "Exit"