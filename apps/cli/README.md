# rio-cli

The command-line client for [Rio](https://github.com/JayTheCoder77/rio), an automated
code review tool. Review your local diffs from the terminal, backed by the same
AI review engine used by Rio's GitHub App.

## Installation

```sh
pip install rio-cli
```

This installs the `rio` command.

## Authentication

Before using `rio review`, authenticate with a Rio API key (create one on your Rio
dashboard's API keys page):

```sh
rio auth
```

This prompts for your API key, validates it against your Rio instance, and saves it to the
platform-specific config file shown below. On POSIX the file is written with restricted
(`0600`) permissions; on Windows it lives under your already-private `%APPDATA%`.

| OS | Config file |
| --- | --- |
| Linux | `~/.config/rio/config.toml` |
| macOS | `~/Library/Application Support/rio/config.toml` |
| Windows | `%APPDATA%\rio\config.toml` |

The directory is created for you on first run, so you never need to mkdir by hand.

## Usage

```sh
# Review currently staged changes
rio review --staged

# Review uncommitted changes (staged + unstaged)
rio review --uncommitted

# Review the last commit
rio review --committed

# Review a diff from a file
rio review --diff path/to.diff

# Include untracked files alongside any of the above
rio review --staged --include-untracked
```

## Configuration

`rio auth` manages the platform-specific config file for you (see the table above for the
exact location per OS). To point the CLI at a self-hosted `ai-engine` instance instead of
the default (`https://rio-ai-engine.onrender.com`), edit the `[api] url` value in that
file, or set it before running `rio auth`:

```toml
[api]
url = "https://your-rio-instance.example.com"
api_key = "your-api-key"
```

## License

[ISC](LICENSE) © 2026 JayTheCoder77
