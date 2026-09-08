import os

# Rough token-cost guardrails. Tune per deployment via env vars rather
# than editing code. MAX_CONTEXT_CHARS is the *total* packed-prompt budget
# across guidelines, learnings, hunk windows, and retrieved snippets.
MAX_DIFF_CHARS = int(os.getenv("MAX_DIFF_CHARS", "40000"))
MAX_CONTEXT_CHARS = int(os.getenv("MAX_CONTEXT_CHARS", "5000"))
HUNK_WINDOW_RADIUS = 40
