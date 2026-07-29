from rio_core.models import ParsedFile
from unidiff import PatchSet

def parse_diff(diff: str) -> list[ParsedFile]:
    patch = PatchSet(diff)
    parsed_files: list[ParsedFile] = []
    for file in patch:
        added_lines: set[int] = set()
        for hunk in file:
            for line in hunk:
                if line.is_added:
                    added_lines.add(line.target_line_no)
        parsed_files.append(ParsedFile(path=file.path, added_lines=added_lines))
        
    return parsed_files
