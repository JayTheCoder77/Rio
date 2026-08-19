# rio-core

Shared models, diff parsing, and code-chunking utilities for [Rio](https://github.com/JayTheCoder77/rio) — an automated code review tool.

This package underpins both Rio's AI review engine and its CLI (`rio-cli`), so the
`Finding`/`RioConfig` schema they exchange has a single source of truth.

## What's in here

- `rio_core.models` — `Finding`, `ParsedFile`, `RetrievedChunk`, `Severity`.
- `rio_core.config` — `RioConfig`, the schema for a repo's `.rio.yml`.
- `rio_core.diff` — `parse_diff()`, turning a unified diff into `ParsedFile`s.
- `rio_core.chunking` — `chunk_file()` / `walk_repo()`, used by Rio's indexing pipeline.
- `rio_core.sandbox` — `SandboxInput`/`SandboxOutput`/`LintResult` for the lint/SAST sidecar.

## Installation

```sh
pip install rio-review-core
```

## License

[ISC](LICENSE) © 2026 JayTheCoder77
