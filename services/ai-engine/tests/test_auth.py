from app.auth import hash_api_key, verify_internal_service_token


def test_hash_api_key_is_sha256_hex():
    assert hash_api_key("key") == hash_api_key("key")
    assert len(hash_api_key("key")) == 64
    assert hash_api_key("a") != hash_api_key("b")


def test_verify_internal_service_token_matches_when_env_set(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "shared-secret")
    assert verify_internal_service_token("shared-secret") is True
    assert verify_internal_service_token("wrong") is False
    assert verify_internal_service_token(None) is False


def test_verify_internal_service_token_false_when_env_missing():
    assert verify_internal_service_token("anything") is False