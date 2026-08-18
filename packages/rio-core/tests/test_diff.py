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