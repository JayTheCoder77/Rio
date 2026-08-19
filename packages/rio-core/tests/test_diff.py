from rio_core.diff import parse_diff


def test_parse_diff_single_added_line():
    diff = """\
diff --git a/src/main.py b/src/main.py
index e69de29..8c7e5a6 100644
--- a/src/main.py
+++ b/src/main.py
@@ -1,3 +1,4 @@
 import os
 print("Hello")
+print("World")
 print("Done")
"""

    parsed = parse_diff(diff)

    assert len(parsed) == 1

    file = parsed[0]
    assert file.path == "src/main.py"
    assert file.added_lines == {3: 'print("World")\n'}


def test_parse_diff_multiple_files():
    diff = """\
diff --git a/a.py b/a.py
--- a/a.py
+++ b/a.py
@@ -1 +1,2 @@
 x
+y
diff --git a/b.py b/b.py
--- a/b.py
+++ b/b.py
@@ -1 +1,2 @@
 z
+w
"""
    parsed = parse_diff(diff)
    assert [f.path for f in parsed] == ["a.py", "b.py"]
    assert set(parsed[0].added_lines) == {2}
    assert set(parsed[1].added_lines) == {2}


def test_parse_diff_line_numbers_span_hunks():
    # A file split across two hunks — added-line numbers must be target-file
    # line numbers, correct per-hunk (the classic one-ParsedFile-per-hunk bug).
    diff = """\
diff --git a/src/main.py b/src/main.py
--- a/src/main.py
+++ b/src/main.py
@@ -1,3 +1,4 @@
 line1
 line2
 line3
+line4
@@ -10,3 +11,4 @@
 line10
 line11
 line12
+line14
"""
    parsed = parse_diff(diff)
    assert len(parsed) == 1
    assert parsed[0].path == "src/main.py"
    assert set(parsed[0].added_lines) == {4, 14}
    assert parsed[0].added_lines[4] == "line4\n"
    assert parsed[0].added_lines[14] == "line14\n"


def test_parse_diff_deleted_file_has_no_added_lines():
    diff = """\
diff --git a/old.py b/old.py
deleted file mode 100644
--- a/old.py
+++ /dev/null
@@ -1 +0,0 @@
-print('gone')
"""
    parsed = parse_diff(diff)
    assert len(parsed) == 1
    assert parsed[0].path == "old.py"
    assert parsed[0].added_lines == {}


def test_parse_diff_new_file():
    diff = """\
diff --git a/new.py b/new.py
new file mode 100644
--- /dev/null
+++ b/new.py
@@ -0,0 +1 @@
+print('hi')
"""
    parsed = parse_diff(diff)
    assert len(parsed) == 1
    assert parsed[0].path == "new.py"
    assert parsed[0].added_lines == {1: "print('hi')\n"}


def test_parse_diff_empty_returns_no_files():
    assert parse_diff("") == []


def test_parse_diff_modified_line_not_added():
    # A context line that changes (no +/-) must not appear as added.
    diff = """\
diff --git a/f.py b/f.py
--- a/f.py
+++ b/f.py
@@ -5,2 +5,2 @@
-old line
+new line
 old unchanged
"""
    parsed = parse_diff(diff)
    assert set(parsed[0].added_lines) == {5}