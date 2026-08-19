import os
import stat

import httpx
import tomllib
import typer

from rio_cli.config import CONFIG_PATH, get_ai_engine_url
from rio_cli.utils import _fail


def _load_existing_config() -> dict:
    if not CONFIG_PATH.exists():
        return {}
    try:
        with CONFIG_PATH.open("rb") as f:
            return tomllib.load(f)
    except tomllib.TOMLDecodeError:
        return {}


def _write_config(data: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)

    api_section = data.get("api", {})
    lines = ["[api]"]
    if "url" in api_section:
        lines.append(f'url = "{api_section["url"]}"')
    lines.append(f'api_key = "{api_section["api_key"]}"')

    CONFIG_PATH.write_text("\n".join(lines) + "\n")
    # This file holds a real credential — don't rely on the default umask.
    os.chmod(CONFIG_PATH, stat.S_IRUSR | stat.S_IWUSR)  # 0o600


def _validate_api_key(api_key: str, ai_engine_url: str) -> None:
    try:
        response = httpx.get(
            f"{ai_engine_url}/v1/me",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=15.0,
        )
    except httpx.ConnectError:
        _fail(f"Error: could not connect to ai-engine at {ai_engine_url}.")
    except httpx.TimeoutException:
        _fail("Error: ai-engine request timed out.")

    if response.status_code == 401:
        _fail("Error: invalid API key. Create one at your Rio dashboard's API keys page.")
    if response.status_code != 200:
        _fail(f"Error: ai-engine returned {response.status_code}: {response.text}")


def auth() -> None:
    """Authenticate the CLI with a Rio API key, created via the Rio dashboard."""
    existing = _load_existing_config()
    ai_engine_url = existing.get("api", {}).get("url") or get_ai_engine_url()

    api_key = typer.prompt(
        "Paste your Rio API key (create one at your Rio dashboard's API keys page)",
        hide_input=True,
    ).strip()

    if not api_key:
        _fail("Error: no API key provided.")

    _validate_api_key(api_key, ai_engine_url)

    existing["api"] = {**existing.get("api", {}), "api_key": api_key, "url": ai_engine_url}
    _write_config(existing)

    typer.echo(f"Authenticated. Config saved to {CONFIG_PATH}")
