import pytest
from app.crypto import (
    EncryptionKeyError,
    _get_key,
    decrypt_provider_key,
    encrypt_provider_key,
)


def test_roundtrip(monkeypatch):
    monkeypatch.setenv("ENCRYPTION_KEY", __import__("base64").b64encode(b"x" * 32).decode())
    secret = "sk-or-v1-some-long-provider-key"
    encoded = encrypt_provider_key(secret)
    assert encoded != secret
    assert decrypt_provider_key(encoded) == secret


def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("ENCRYPTION_KEY", raising=False)
    with pytest.raises(EncryptionKeyError, match="ENCRYPTION_KEY is not set"):
        encrypt_provider_key("secret")


def test_wrong_length_key_raises(monkeypatch):
    monkeypatch.setenv("ENCRYPTION_KEY", __import__("base64").b64encode(b"short").decode())
    with pytest.raises(EncryptionKeyError, match="must decode to 32 bytes"):
        _get_key()


def test_tampered_ciphertext_fails(monkeypatch):
    monkeypatch.setenv("ENCRYPTION_KEY", __import__("base64").b64encode(b"x" * 32).decode())
    encoded = encrypt_provider_key("secret")
    corrupted = ("A" if encoded[0] != "A" else "B") + encoded[1:]
    with pytest.raises(Exception) as exc:
        decrypt_provider_key(corrupted)
    # GCM auth failure → InvalidTag
    assert type(exc.value).__name__ == "InvalidTag"


def test_wire_format_layout(monkeypatch):
    import base64

    key = base64.b64encode(b"x" * 32).decode()
    monkeypatch.setenv("ENCRYPTION_KEY", key)
    encoded = encrypt_provider_key("abc")
    raw = base64.b64decode(encoded)
    # base64(iv[12] || ciphertext || tag[16])
    assert len(raw) >= 12 + 16
    # Random IV means two encryptions of the same value differ.
    assert encrypt_provider_key("abc") != encoded