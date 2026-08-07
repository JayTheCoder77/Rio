from rio_core.chunking import walk_repo
  
# does it actually skip binaries?
files = walk_repo(".")  # run from repo root — will it choke on committed binaries?
print(f"repo root: {len(files)} files")

for path, content in files[:10]:  # print first 10 files
    print(f"=== {path} ===")
    print(f"Length: {len(content)} characters")
    print(content[:100])  # first 100 characters
    print()