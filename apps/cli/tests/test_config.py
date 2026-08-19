import httpx
import pytest
import typer
from rio_cli import auth as auth_mod
from rio_cli import config


class FakeResponse:
    def __init__(self, status_code=200):
        self.status_code = status_code


@pytest.fixture()
def config_path(tmp_path, monkeypatch):
    """Points both config.py and auth.py at an isolated config file."""
    path = tmp_path / "config.toml"
    monkeypatch.setattr(config, "CONFIG_PATH", path)
    monkeypatch.setattr(auth_mod, "CONFIG_PATH", path)
    return path


def write_config(config_path, **api_kwargs):
    config_path.parent.mkdir(parents=True, exist_ok=True)
    if not api_kwargs:
        config_path.write_text("[api]\n")
        return
    lines = ["[api]"]
    for k, v in api_kwargs.items():
        lines.append(f'{k} = "{v}"')
    config_path.write_text("\n".join(lines) + "\n")


class TestGetAiEngineUrl:
    def test_default_when_no_config(self, config_path):
        assert config.get_ai_engine_url() == "http://localhost:8000"

    def test_reads_url_from_config(self, config_path):
        write_config(config_path, url="http://engine:9999")
        assert config.get_ai_engine_url() == "http://engine:9999"

    def test_missing_url_fails(self, config_path):
        write_config(config_path)
        with pytest.raises(typer.Exit):
            config.get_ai_engine_url()

    def test_corrupt_toml_fails(self, config_path):
        config_path.write_text("not [valid toml")
        with pytest.raises(typer.Exit):
            config.get_ai_engine_url()


class TestGetApiKey:
    def test_none_when_no_config(self, config_path):
        assert config.get_api_key() is None

    def test_reads_key(self, config_path):
        write_config(config_path, api_key="rio_abc")
        assert config.get_api_key() == "rio_abc"

    def test_none_when_missing(self, config_path):
        write_config(config_path, url="http://x")
        assert config.get_api_key() is None


class TestAuthConfigWrite:
    def test_writes_0600_permissions(self, config_path, monkeypatch):
        import stat

        def fake_prompt(text, **kwargs):
            return "rio_testkey"

        monkeypatch.setattr(auth_mod.typer, "prompt", fake_prompt)

        monkeypatch.setattr(
            auth_mod.httpx, "get", lambda url, **kwargs: FakeResponse(200)
        )
        monkeypatch.setattr(auth_mod, "get_ai_engine_url", lambda: "http://localhost:8000")

        auth_mod.auth()

        assert config_path.exists()
        mode = stat.S_IMODE(config_path.stat().st_mode)
        assert mode == 0o600
        assert "rio_testkey" in config_path.read_text()

    def test_invalid_key_fails_before_writing(self, config_path, monkeypatch):
        def fake_prompt(text, **kwargs):
            return "rio_bad"

        monkeypatch.setattr(auth_mod.typer, "prompt", fake_prompt)

        monkeypatch.setattr(
            auth_mod.httpx, "get", lambda url, **kwargs: FakeResponse(401)
        )
        monkeypatch.setattr(auth_mod, "get_ai_engine_url", lambda: "http://localhost:8000")

        with pytest.raises(typer.Exit):
            auth_mod.auth()
        assert not config_path.exists()

    def test_validate_connect_error_fails(self, config_path, monkeypatch):
        def boom(url, **kwargs):
            raise httpx.ConnectError("down")

        monkeypatch.setattr(auth_mod.httpx, "get", boom)
        with pytest.raises(typer.Exit):
            auth_mod._validate_api_key("rio_x", "http://localhost:8000")

    def test_validate_timeout_fails(self, config_path, monkeypatch):
        def boom(url, **kwargs):
            raise httpx.TimeoutException("slow")

        monkeypatch.setattr(auth_mod.httpx, "get", boom)
        with pytest.raises(typer.Exit):
            auth_mod._validate_api_key("rio_x", "http://localhost:8000")

    def test_load_existing_config_merges_on_write(self, config_path, monkeypatch):
        write_config(config_path, url="http://engine:9000")
        monkeypatch.setattr(auth_mod.typer, "prompt", lambda text, **kw: "rio_new")
        monkeypatch.setattr(
            auth_mod.httpx, "get", lambda url, **kw: FakeResponse(200)
        )
        monkeypatch.setattr(auth_mod, "get_ai_engine_url", lambda: "http://localhost:8000")

        auth_mod.auth()
        text = config_path.read_text()
        assert 'url = "http://engine:9000"' in text
        assert 'api_key = "rio_new"' in text