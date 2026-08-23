# Changelog

All notable changes to `rio-cli` are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2026-08-23

### Added

- **Windows support for the config file.** The CLI now resolves its config path
  per-platform instead of hardcoding the Linux/macOS `~/.config/rio/config.toml`:
  - Linux: `~/.config/rio/config.toml`
  - macOS: `~/Library/Application Support/rio/config.toml`
  - Windows: `%APPDATA%\rio\config.toml`
- Widened `requires-python` to `>=3.12` (previously capped below 3.13).

### Changed

- The credential file is now `chmod 0600` only on POSIX. On Windows the file
  already lives under the per-user-private `%APPDATA%`, where the POSIX mode has
  no meaning.

## [0.2.1] - 2026-08-22

### Added

- Initial public release of the `rio` CLI: `rio auth` and `rio review` with
  staged / uncommitted / committed / file-diff modes.
