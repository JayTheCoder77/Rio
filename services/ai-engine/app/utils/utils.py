from rio_core.models import RetrievedChunk


def format_context(chunks: list[RetrievedChunk]) -> str:
    if not chunks:
        return "No related context was retrieved."
    parts = [
        f"### {c.file_path} (lines {c.start_line}-{c.end_line})\n{c.text}"
        for c in chunks
    ]
    return "\n\n".join(parts)
    
    