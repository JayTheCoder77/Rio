class ProviderCredentialError(RuntimeError):
    """Raised when the caller's BYOK provider (Groq/OpenRouter) rejects the
    request — bad model name, revoked/invalid key, rate limit, etc. Distinct
    from a generic crash: `main.py` catches this and returns a clear 4xx
    instead of an opaque 500, so the CLI and the GitHub App failure comment
    can both show the user something actionable."""


class DiffTooLargeError(RuntimeError):
    """Raised when the diff exceeds MAX_DIFF_CHARS. `main.py` catches this and
    returns a 422 so callers get a clear, actionable message instead of a raw
    500 from an unhandled ValueError."""
