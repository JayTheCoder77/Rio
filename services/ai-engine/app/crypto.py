"""AES-256-GCM decryption for the user's BYOK provider API key
(`users.model_api_key_encrypted`). Encrypted in `apps/web` (dashboard save,
Node's `crypto`), decrypted here per-request to build the LLM client — both
sides must agree on the wire format and key derivation, see
`apps/web/lib/model-credentials.ts` for the mirror implementation.

Wire format: base64(iv[12 bytes] || ciphertext || authTag[16 bytes]).
"""

from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

IV_LENGTH = 12
AUTH_TAG_LENGTH = 16


class EncryptionKeyError(RuntimeError):
    pass


def _get_key() -> bytes:
    raw = os.getenv("ENCRYPTION_KEY")
    if not raw:
        raise EncryptionKeyError(
            "ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` "
            "and set it as a real secret — never commit it to the repo."
        )
    key = base64.b64decode(raw)
    if len(key) != 32:
        raise EncryptionKeyError(
            f"ENCRYPTION_KEY must decode to 32 bytes for AES-256 (got {len(key)}). "
            "Generate one with `openssl rand -base64 32`."
        )
    return key


def decrypt_provider_key(encoded: str) -> str:
    key = _get_key()
    raw = base64.b64decode(encoded)
    iv = raw[:IV_LENGTH]
    # cryptography's AESGCM expects ciphertext with the tag appended at the
    # end (matches Node's ciphertext + authTag layout) — no separate split
    # needed beyond stripping the IV.
    ciphertext_and_tag = raw[IV_LENGTH:]

    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ciphertext_and_tag, None)
    return plaintext.decode("utf-8")


def encrypt_provider_key(plaintext: str) -> str:
    """Not used by ai-engine today (the dashboard owns writes), but kept
    alongside `decrypt_provider_key` so the wire format has one Python-side
    reference implementation for tests/tooling without depending on Node."""
    key = _get_key()
    iv = os.urandom(IV_LENGTH)
    aesgcm = AESGCM(key)
    ciphertext_and_tag = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
    return base64.b64encode(iv + ciphertext_and_tag).decode("ascii")
