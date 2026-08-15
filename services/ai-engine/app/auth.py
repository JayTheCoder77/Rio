import hashlib
import logging
import os

import psycopg
from dotenv import load_dotenv
from fastapi import Header

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

