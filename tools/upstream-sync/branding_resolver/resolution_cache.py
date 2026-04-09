"""SQLite-based cache for file conflict resolutions.

Stores resolved file contents keyed by a SHA-256 hash of the conflict
inputs (file path, ours content, theirs content) so the LLM is not
re-invoked for identical conflicts.
"""

from __future__ import annotations

import hashlib
import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

_DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / ".resolution_cache.db"


class ResolutionCache:
    """Thread-safe SQLite cache mapping conflict inputs to resolved content."""

    def __init__(self, db_path: Path = _DEFAULT_DB_PATH) -> None:
        self._db_path = db_path
        self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS resolutions (
                hash            TEXT PRIMARY KEY,
                file_path       TEXT NOT NULL,
                resolved_content TEXT NOT NULL,
                created_at      TEXT NOT NULL
            )
            """
        )
        self._conn.commit()
        logger.debug("Opened resolution cache at %s", db_path)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @staticmethod
    def _make_key(file_path: str, ours_content: str, theirs_content: str) -> str:
        """Return a SHA-256 hex digest for the given conflict inputs."""
        payload = f"{file_path}|{ours_content}|{theirs_content}"
        return hashlib.sha256(payload.encode()).hexdigest()

    def get(
        self, file_path: str, ours_content: str, theirs_content: str
    ) -> str | None:
        """Return cached resolved content for a conflict, or ``None``."""
        key = self._make_key(file_path, ours_content, theirs_content)
        row = self._conn.execute(
            "SELECT resolved_content FROM resolutions WHERE hash = ?", (key,)
        ).fetchone()
        if row is not None:
            logger.debug("Cache hit for %s (hash=%s)", file_path, key[:12])
            return row[0]
        logger.debug("Cache miss for %s (hash=%s)", file_path, key[:12])
        return None

    def put(
        self,
        file_path: str,
        ours_content: str,
        theirs_content: str,
        resolved_content: str,
    ) -> None:
        """Store a resolution in the cache (upsert)."""
        key = self._make_key(file_path, ours_content, theirs_content)
        now = datetime.now(timezone.utc).isoformat()
        self._conn.execute(
            """
            INSERT INTO resolutions (hash, file_path, resolved_content, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(hash) DO UPDATE SET
                resolved_content = excluded.resolved_content,
                created_at       = excluded.created_at
            """,
            (key, file_path, resolved_content, now),
        )
        self._conn.commit()
        logger.debug("Cached resolution for %s (hash=%s)", file_path, key[:12])

    def clear_expired(self, max_age_days: int = 30) -> int:
        """Remove entries older than *max_age_days* and return the count removed."""
        cutoff = (
            datetime.now(timezone.utc) - timedelta(days=max_age_days)
        ).isoformat()
        cursor = self._conn.execute(
            "DELETE FROM resolutions WHERE created_at < ?", (cutoff,)
        )
        self._conn.commit()
        removed = cursor.rowcount
        if removed:
            logger.info("Purged %d expired cache entries (older than %d days)", removed, max_age_days)
        return removed

    def close(self) -> None:
        """Close the underlying database connection."""
        self._conn.close()
        logger.debug("Closed resolution cache at %s", self._db_path)

    # ------------------------------------------------------------------
    # Context manager
    # ------------------------------------------------------------------

    def __enter__(self) -> ResolutionCache:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: object,
    ) -> None:
        self.close()
