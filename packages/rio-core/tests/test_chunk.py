from pathlib import Path

from rio_core.chunking import chunk_file

file_path = Path("/home/jayant/projects/rio/packages/rio-core/tests/code.py")
content = file_path.read_text()
chunks = chunk_file("code.py", content)
for c in chunks[:3]:
    print(f"--- lines {c.start_line}-{c.end_line} ---")
    print(c.text[:80])