"""
data_layer/visit_store.py
-------------------------
Persistence for Phase 3 active-monitoring visits (the longitudinal trial arm).
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from data_layer.db import get_conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def add_visit(patient_id: str, trial_id: Optional[str], visit_date: str,
              vitals: Dict[str, Any], monitor: Dict[str, Any]) -> str:
    visit_id = "vis-" + uuid.uuid4().hex[:10]
    safety = monitor.get("safety", {})
    efficacy = monitor.get("efficacy", {})
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO visits (visit_id, patient_id, trial_id, visit_date, vitals_json, "
            "anomaly_score, is_anomaly, efficacy_status, monitor_json, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (visit_id, patient_id, trial_id, visit_date, json.dumps(vitals),
             safety.get("anomaly_score"), 1 if safety.get("is_anomaly") else 0,
             efficacy.get("status"), json.dumps(monitor), _now()),
        )
    return visit_id


def list_visits(patient_id: str) -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM visits WHERE patient_id = ? ORDER BY visit_date", (patient_id,)
        ).fetchall()
    out = []
    for r in rows:
        out.append({
            "visit_id": r["visit_id"],
            "patient_id": r["patient_id"],
            "trial_id": r["trial_id"],
            "visit_date": r["visit_date"],
            "vitals": json.loads(r["vitals_json"]),
            "anomaly_score": r["anomaly_score"],
            "is_anomaly": bool(r["is_anomaly"]),
            "efficacy_status": r["efficacy_status"],
            "monitoring_status": (json.loads(r["monitor_json"]).get("monitoring_status")
                                  if r["monitor_json"] else None),
            "monitor": json.loads(r["monitor_json"]) if r["monitor_json"] else None,
        })
    return out


def biomarker_series_from_visits(patient_id: str, biomarker: str) -> List[Dict[str, Any]]:
    """Build a chronological series of a biomarker from recorded visits."""
    series = []
    for v in list_visits(patient_id):
        val = v["vitals"].get(biomarker)
        if val is not None:
            series.append({"date": v["visit_date"], "value": float(val)})
    return series
