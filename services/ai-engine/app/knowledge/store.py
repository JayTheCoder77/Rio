import logging
import os

import psycopg
from rio_core.models import Learning, PathGuideline

logger = logging.getLogger(__name__)


def _connect():
    db = os.getenv("DATABASE_URL")
    if not db:
        return None
    return psycopg.connect(db)


def load_guidelines(repo_id: str) -> list[PathGuideline]:
    conn = _connect()
    if conn is None:
        return []
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT path_glob, rule_text
                FROM coding_guidelines
                WHERE repo_id = %s
                """,
                (repo_id,),
            )
            rows = cur.fetchall()
    except Exception as exc:  # noqa: BLE001 — degrade; never fail a review
        logger.warning("guidelines load skipped: %s", exc)
        return []

    return [PathGuideline(paths=[row[0]], text=row[1]) for row in rows]


def load_learnings(repo_id: str) -> list[Learning]:
    conn = _connect()
    if conn is None:
        return []
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT path_glob, pattern, instruction
                FROM learnings
                WHERE repo_id = %s AND active = true
                """,
                (repo_id,),
            )
            rows = cur.fetchall()
    except Exception as exc:  # noqa: BLE001
        logger.warning("learnings load skipped: %s", exc)
        return []

    return [
        Learning(path_glob=row[0], pattern=row[1], instruction=row[2])
        for row in rows
    ]


def upsert_pr_index(
    repo_id: str,
    pr_number: int,
    title: str,
    body: str,
    head_sha: str | None,
) -> None:
    conn = _connect()
    if conn is None:
        return
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO pr_index (repo_id, pr_number, title, body, head_sha)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (repo_id, pr_number)
                DO UPDATE SET title = EXCLUDED.title,
                              body = EXCLUDED.body,
                              head_sha = EXCLUDED.head_sha,
                              indexed_at = now()
                """,
                (repo_id, pr_number, title, body, head_sha),
            )
            conn.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("pr_index upsert skipped: %s", exc)


def upsert_issue_index(
    repo_id: str,
    issue_number: int,
    title: str,
    body: str,
    state: str | None,
) -> None:
    conn = _connect()
    if conn is None:
        return
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO issues_index (repo_id, issue_number, title, body, state)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (repo_id, issue_number)
                DO UPDATE SET title = EXCLUDED.title,
                              body = EXCLUDED.body,
                              state = EXCLUDED.state,
                              indexed_at = now()
                """,
                (repo_id, issue_number, title, body, state),
            )
            conn.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("issues_index upsert skipped: %s", exc)
