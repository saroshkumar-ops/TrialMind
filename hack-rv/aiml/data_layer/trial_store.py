"""
data_layer/trial_store.py
-------------------------
CRUD for trials + their extracted criteria + the derived enrollment form schema.

Three demo trials are seeded (diabetes, hypertension, COPD) so the app works out of
the box AND so judges can see the enrollment form change per trial. Each trial's
`enroll_fields` is DERIVED from its criteria (data_layer.enroll_schema), so uploading
a different protocol PDF (POST /trials/{id}/protocol) regenerates the form.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from data_layer.db import get_conn
from data_layer.enroll_schema import derive_enroll_fields
from utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_TRIAL_ID = "default-t2dm"

# --- Three demo trials. Each has clearly DIFFERENT clinical inputs. ---
_DEMO_TRIALS: List[Dict[str, Any]] = [
    {
        "trial_id": DEFAULT_TRIAL_ID,
        "name": "T2DM Glycemic Control Trial",
        "protocol_text": (
            "Phase III randomized trial of an investigational once-daily oral agent for "
            "glycemic control in adults with type 2 diabetes mellitus. "
            "Inclusion criteria: Age 18-75; HbA1c 6.5-9.0; BMI 25-40. "
            "Exclusion criteria: Chronic kidney disease; Pregnancy."
        ),
        "inclusion": ["Age 18-75", "HbA1c 6.5-9.0", "BMI 25-40"],
        "exclusion": ["Chronic kidney disease", "Pregnancy"],
    },
    {
        "trial_id": "htn-cvd",
        "name": "Resistant Hypertension CV Outcomes Trial",
        "protocol_text": (
            "Phase III trial of a novel antihypertensive in adults with resistant "
            "hypertension. Inclusion criteria: Age 40-80; Systolic BP 140-180; "
            "Diastolic BP 90-110. Exclusion criteria: Prior stroke; Pregnancy."
        ),
        "inclusion": ["Age 40-80", "Systolic BP 140-180", "Diastolic BP 90-110"],
        "exclusion": ["Prior stroke", "Pregnancy"],
    },
    {
        "trial_id": "copd-resp",
        "name": "COPD Maintenance Inhaler Trial",
        "protocol_text": (
            "Phase III trial of a dual bronchodilator maintenance inhaler in patients "
            "with moderate-to-severe COPD. Inclusion criteria: Age 40-75; FEV1 30-70; "
            "Smoking history. Exclusion criteria: Active respiratory infection."
        ),
        "inclusion": ["Age 40-75", "FEV1 30-70", "Smoking history"],
        "exclusion": ["Active respiratory infection"],
    },
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(row) -> Dict[str, Any]:
    return {
        "trial_id": row["trial_id"],
        "name": row["name"],
        "protocol_text": row["protocol_text"],
        "inclusion": json.loads(row["inclusion_json"] or "[]"),
        "exclusion": json.loads(row["exclusion_json"] or "[]"),
        "enroll_fields": json.loads(row["enroll_fields_json"] or "[]"),
        "created_at": row["created_at"],
    }


def _insert(conn, t: Dict[str, Any]) -> None:
    fields = derive_enroll_fields(t["inclusion"], t["exclusion"])
    conn.execute(
        "INSERT OR IGNORE INTO trials (trial_id, name, protocol_text, inclusion_json, "
        "exclusion_json, enroll_fields_json, created_at) VALUES (?,?,?,?,?,?,?)",
        (t["trial_id"], t["name"], t.get("protocol_text", ""),
         json.dumps(t["inclusion"]), json.dumps(t["exclusion"]),
         json.dumps(fields), _now()),
    )


def seed_demo_trials() -> None:
    """Insert the 3 demo trials if no trials exist yet."""
    with get_conn() as conn:
        n = conn.execute("SELECT COUNT(*) AS n FROM trials").fetchone()["n"]
        if n > 0:
            return
        for t in _DEMO_TRIALS:
            _insert(conn, t)
    logger.info("Seeded %d demo trials", len(_DEMO_TRIALS))


# Back-compat alias (older code/docs call seed_default_trial).
def seed_default_trial() -> None:
    seed_demo_trials()


def create_trial(name: str, protocol_text: str = "",
                 inclusion: Optional[List[str]] = None,
                 exclusion: Optional[List[str]] = None) -> Dict[str, Any]:
    trial_id = uuid.uuid4().hex[:12]
    inclusion = inclusion or []
    exclusion = exclusion or []
    fields = derive_enroll_fields(inclusion, exclusion)
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO trials (trial_id, name, protocol_text, inclusion_json, "
            "exclusion_json, enroll_fields_json, created_at) VALUES (?,?,?,?,?,?,?)",
            (trial_id, name, protocol_text, json.dumps(inclusion),
             json.dumps(exclusion), json.dumps(fields), _now()),
        )
    return get_trial(trial_id)


def list_trials() -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM trials ORDER BY created_at").fetchall()
    return [_row_to_dict(r) for r in rows]


def get_trial(trial_id: str) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM trials WHERE trial_id = ?", (trial_id,)).fetchone()
    return _row_to_dict(row) if row else None


def update_criteria(trial_id: str, protocol_text: str,
                    inclusion: List[str], exclusion: List[str]) -> Optional[Dict[str, Any]]:
    """
    Store criteria extracted from an uploaded protocol PDF AND regenerate the
    enrollment form schema from them — this is what changes the enroll form per PDF.
    """
    fields = derive_enroll_fields(inclusion, exclusion)
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE trials SET protocol_text = ?, inclusion_json = ?, exclusion_json = ?, "
            "enroll_fields_json = ? WHERE trial_id = ?",
            (protocol_text, json.dumps(inclusion), json.dumps(exclusion),
             json.dumps(fields), trial_id),
        )
        if cur.rowcount == 0:
            return None
    return get_trial(trial_id)
