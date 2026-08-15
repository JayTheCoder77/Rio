import subprocess
from pathlib import Path

import yaml
from rio_core.config import RioConfig


def _get_repo_root() -> Path | None:
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    return Path(result.stdout.strip())


def load_rio_config() -> RioConfig:
    repo_root = _get_repo_root()
    if repo_root is None:
        return RioConfig()

    config_path = repo_root / ".rio.yml"
    if not config_path.exists():
        return RioConfig()

    try:
        data = yaml.safe_load(config_path.read_text())
    except yaml.YAMLError:
        return RioConfig()

    return RioConfig(**(data or {}))