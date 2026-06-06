"""
data_layer/db.py
----------------
SQLite connection + schema bootstrap. Uses the Python stdlib `sqlite3` (no extra
dependency). One file DB lives at aiml/data/trialmind.db.

Thread note: FastAPI/uvicorn may serve requests on different threads, so we open a
fresh connection per call (cheap for SQLite) with check_same_thread=False and
WAL mode for concurrent reads.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

DB_PATH: Path = settings.base_dir / "data" / "trialmind.db"


SCHEMA = """
CREATE TABLE IF NOT EXISTS trials (
    trial_id           TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    protocol_text      TEXT,
    inclusion_json     TEXT NOT NULL DEFAULT '[]',
    exclusion_json     TEXT NOT NULL DEFAULT '[]',
    enroll_fields_json TEXT NOT NULL DEFAULT '[]',   -- trial-driven enrollment form schema
    created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
    patient_id          TEXT PRIMARY KEY,   -- Synthea fhirId or generated id for self-enrolled
    name                TEXT,
    age                 INTEGER,
    gender              TEXT,
    hba1c               REAL,
    bmi                 REAL,
    glucose             REAL,
    kidney_disease      INTEGER NOT NULL DEFAULT 0,
    features_json       TEXT NOT NULL,       -- the 11/12-key risk feature dict
    clinical_json       TEXT,                -- trial-specific clinical fields submitted at enroll
    adherence_json      TEXT,                -- adherence overlay entry (nullable)
    source              TEXT NOT NULL DEFAULT 'synthea',  -- 'synthea' | 'self-enroll'
    trial_id            TEXT,                -- assigned trial (nullable)
    screening_decision  TEXT,                -- cached last auto-screen decision (nullable)
    enrolled            INTEGER NOT NULL DEFAULT 0,  -- clinician-approved → under observation
    created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patients_trial ON patients(trial_id);

CREATE TABLE IF NOT EXISTS visits (
    visit_id        TEXT PRIMARY KEY,
    patient_id      TEXT NOT NULL,
    trial_id        TEXT,
    visit_date      TEXT NOT NULL,
    vitals_json     TEXT NOT NULL,        -- {hba1c, glucose, bmi, heart_rate, weight, ...}
    anomaly_score   REAL,
    is_anomaly      INTEGER NOT NULL DEFAULT 0,
    efficacy_status TEXT,
    monitor_json    TEXT,                 -- full composite monitor result
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id, visit_date);
"""


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    fresh = not DB_PATH.exists()  # file vanished (e.g. deleted under a running server)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    # Self-heal: if the DB file was missing, sqlite just created an EMPTY one.
    # Recreate the schema so reads return empty results instead of a 500 crash.
    if fresh:
        conn.executescript(SCHEMA)
        logger.warning("DB file was missing — recreated schema (data needs reseed; restart to seed).")
    return conn


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    """Context manager yielding a connection; commits on success, rolls back on error."""
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _migrate(conn: sqlite3.Connection) -> None:
    """Idempotently add columns to pre-existing DBs (CREATE IF NOT EXISTS won't alter)."""
    wanted = {
        "trials": [("enroll_fields_json", "TEXT NOT NULL DEFAULT '[]'")],
        "patients": [("clinical_json", "TEXT"),
                     ("enrolled", "INTEGER NOT NULL DEFAULT 0")],
    }
    for table, cols in wanted.items():
        existing = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        for col, decl in cols:
            if col not in existing:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")
                logger.info("Migrated: added %s.%s", table, col)


def init_db() -> None:
    """Create tables if they don't exist, then run lightweight migrations."""
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)
    logger.info("SQLite schema ready at %s", DB_PATH)


def patient_count() -> int:
    with get_conn() as conn:
        return conn.execute("SELECT COUNT(*) AS n FROM patients").fetchone()["n"]


def trial_count() -> int:
    with get_conn() as conn:
        return conn.execute("SELECT COUNT(*) AS n FROM trials").fetchone()["n"]
