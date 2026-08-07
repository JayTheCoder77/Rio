from unidiff import PatchSet

from rio_core.models import ParsedFile


def parse_diff(diff: str) -> list[ParsedFile]:
    patch = PatchSet(diff)
    parsed_files: list[ParsedFile] = []
    for file in patch:
        added_lines: dict[int , str] = dict[int , str]()       
        for hunk in file:
            for line in hunk:
                if line.is_added:
                    added_lines[line.target_line_no] = line.value
        parsed_files.append(ParsedFile(path=file.path, added_lines=added_lines))
        
    return parsed_files
