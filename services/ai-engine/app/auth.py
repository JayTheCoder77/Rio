import hashlib
import logging
import os

import psycopg
from dotenv import load_dotenv
from fastapi import Header, HTTPException

from app.crypto import decrypt_provider_key
from app.state import LlmCredential

load_dotenv()

db = os.getenv("DATABASE_URL")
logger = logging.getLogger(__name__)

def hash_api_key(plaintext:str) -> str:
    return hashlib.sha256(plaintext.encode()).hexdigest()

def get_current_user(authorization : str | None = Header(default=None)) -> str | None:
    if not authorization or not authorization.startswith('Bearer '):
        return None
        
    token = authorization.removeprefix('Bearer ').strip()
    if not token:
        return None
    key_hash = hash_api_key(token)

    try:
        with psycopg.connect(db) as conn, conn.cursor() as cur:
            cur.execute("""
                    SELECT user_id FROM api_keys
                    WHERE key_hash = %s and revoked_at IS NULL
                """ , (key_hash,) ,)
            row = cur.fetchone()
        
        if row is None:
            return None
        return str(row[0])
    except psycopg.Error:
        # Degrade to free tier on any DB error (including outages), same as
        # a missing/invalid key, rather than hard-failing the request.
        #
        # POST-MVP: this collapses three distinct cases into the same
        # `None` return value — "no key provided", "key provided but
        # invalid/revoked", and "key provided but the DB was unreachable
        # so we couldn't check it". Once real tier enforcement/usage
        # tracking is built, this function should return a richer result
        # (e.g. an enum: no_key / invalid_key / db_unavailable /
        # authenticated) so callers can decide policy per-case instead of
        # everything silently becoming free tier. For now that distinction
        # doesn't matter because nothing reads it.
        logger.exception("Database error while validating API key")
        return None

def require_current_user(authorization : str | None = Header(default=None)) -> str:
    """Like `get_current_user`, but hard-fails with 401 instead of degrading to
    an anonymous/free-tier `None`. Used by endpoints where an invalid key must
    be rejected outright — e.g. `rio auth`, which exists specifically to catch
    a bad paste before it's cached locally."""
    user_id = get_current_user(authorization)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return user_id


def verify_internal_service_token(x_internal_service_token: str | None = Header(default=None)) -> bool:
    """Trust boundary for the GitHub App/worker path: the worker has direct
    Postgres access and resolves the owning Rio user for an installation
    itself (see `getInstallationOwnerId` in `packages/db`), then asserts
    "run this review as this user" via `ReviewState.on_behalf_of_user_id`
    rather than authenticating as that user with a Bearer key (there isn't
    one — the GitHub App has no per-request user credential). This token is
    a shared secret between the worker and ai-engine, never exposed publicly,
    and is a *distinct* trust boundary from a Rio API key: it authenticates
    "this caller is our own trusted worker", not "this caller is this user"."""
    expected = os.getenv("INTERNAL_SERVICE_TOKEN")
    if not expected:
        return False
    return x_internal_service_token is not None and x_internal_service_token == expected


def get_user_llm_credential(user_id: str) -> LlmCredential | None:
    """Looks up and decrypts the caller's BYOK provider credential (Groq or
    OpenRouter), set once via the Rio dashboard settings page and stored
    encrypted on `users.model_api_key_encrypted`. Returns `None` if the user
    hasn't configured one yet — callers must fail closed on `None`, not fall
    back to any shared/self-hosted key."""
    try:
        with psycopg.connect(db) as conn, conn.cursor() as cur:
            cur.execute("""
                    SELECT model_provider, model_name, model_api_key_encrypted
                    FROM users WHERE id = %s
                """ , (user_id,) ,)
            row = cur.fetchone()
    except psycopg.Error:
        logger.exception("Database error while resolving LLM credential")
        return None

    if row is None:
        return None

    provider, model_name, api_key_encrypted = row
    if not provider or not model_name or not api_key_encrypted:
        return None

    try:
        api_key = decrypt_provider_key(api_key_encrypted)
    except Exception:
        logger.exception("Failed to decrypt stored LLM credential for user %s", user_id)
        return None

    return LlmCredential(provider=provider, api_key=api_key, model=model_name)

