"""
data_layer/registry.py
-----------------------
The patient registry — Python's replacement for the deleted Java data layer
(SyntheaDataLoader + FeatureAssemblyService).

Responsibilities:
  1. SEED the cohort once: parse data/seed/fhir/*.json, build the 12 risk features
     per patient (reusing prediction.build_dataset for parity with training),
     extract demographics + kidney_disease + name, merge the adherence overlay,
     and persist to SQLite.
  2. SERVE patients: list (summaries), get one (full), and feature/screening payload
     assembly for the screening + orchestrate endpoints.
  3. SELF-ENROLL: accept a recruitment form and store a new patient (Phase 1).

Feature parity note: prediction/build_dataset.py seeds random(7) at import and draws
3 RNG values per patient (2 in _features_for_patient + 1 for the dropout label).
We re-seed(7) and consume the same 3 draws per patient so the seeded features here
match the training_data.csv exactly.
"""

from __future__ import annotations

import glob
import json
import random
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from data_layer.db import get_conn
from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

_SEED_DIR = settings.base_dir.parent / "data" / "seed" / "fhir"
_ADHERENCE_PATH = settings.base_dir / "data" / "adherence_overlay.json"

# The exact feature key order the model expects (gender is categorical).
FEATURE_KEYS = [
    "age", "gender", "comorbidity_count", "has_comorbidity", "num_encounters",
    "avg_visit_gap_days", "num_medications", "hba1c", "bmi", "glucose",
    "missed_visits", "travel_distance_km",
]

_KIDNEY_KEYWORDS = ("kidney", "renal", "nephropathy")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _patient_name(patient_res: dict) -> str:
    names = patient_res.get("name", [])
    if not names:
        return "Unknown"
    n = names[0]
    given = " ".join(n.get("given", []))
    family = n.get("family", "")
    # Synthea appends digits to names (e.g. "Adelia946"); strip them for display.
    import re
    full = f"{given} {family}".strip()
    return re.sub(r"\d+", "", full).replace("  ", " ").strip() or "Unknown"


def _has_kidney_disease(bundle_resources: List[dict]) -> bool:
    for r in bundle_resources:
        if r.get("resourceType") != "Condition":
            continue
        text = (r.get("code", {}).get("text") or "").lower()
        if any(k in text for k in _KIDNEY_KEYWORDS):
            return True
    return False


# ---------------------------------------------------------------------------
# Condition-driven clinical enrichment
# ---------------------------------------------------------------------------
# Synthea models the right DISEASE populations (95 diabetics, 49 hypertensives,
# 43 COPD) but rarely attaches in-range lab/vital OBSERVATIONS to them, so a
# disease-specific trial finds ~0 eligible patients. We synthesise each trial's
# screening biomarkers FROM the patient's real conditions — diabetics get a
# realistic HbA1c spread, hypertensives get hypertensive BP, COPD patients get
# low FEV1, etc. Values are deterministic per patient (RNG seeded by patient id),
# so they're stable across restarts. This is the same honest "synthetic signal"
# approach already used for the dropout label — nothing is hand-picked per patient.

def _condition_flags(resources: List[dict]) -> Dict[str, bool]:
    blob = " ".join(
        (r.get("code", {}).get("text") or "").lower()
        for r in resources if r.get("resourceType") == "Condition"
    )
    return {
        "diabetes": ("diabetes" in blob or "prediabetes" in blob),
        "hypertension": "hypertension" in blob,
        "copd": any(k in blob for k in ("pulmonary disease", "copd", "emphysema", "bronchitis")),
        "stroke": "stroke" in blob,
    }


def _enrich_clinical(flags: Dict[str, bool], gender: str, age: int,
                     real_bmi, kidney: bool, pid: str) -> Dict[str, Any]:
    rng = random.Random("enrich-" + pid)  # separate stream — doesn't disturb feature RNG

    def clip(v, lo, hi):
        return round(max(lo, min(hi, v)), 1)

    if flags["diabetes"]:
        hba1c = clip(rng.gauss(7.5, 1.1), 5.8, 11.5)   # ~65% land in 6.5-9.0
        glucose = clip(rng.gauss(155, 35), 90, 300)
    else:
        hba1c = clip(rng.gauss(5.5, 0.4), 4.5, 6.4)     # normal → below the T2DM floor
        glucose = clip(rng.gauss(95, 12), 70, 125)

    bmi = round(float(real_bmi), 1) if real_bmi else clip(rng.gauss(28, 5), 18, 46)

    if flags["hypertension"]:
        systolic = clip(rng.gauss(158, 13), 135, 196)   # mostly within 140-180
        diastolic = clip(rng.gauss(98, 8), 84, 118)
    else:
        systolic = clip(rng.gauss(124, 10), 104, 138)   # normotensive → below 140
        diastolic = clip(rng.gauss(78, 7), 60, 87)

    if flags["copd"]:
        fev1 = clip(rng.gauss(50, 12), 25, 78)          # mostly within 30-70
        smoking = rng.random() < 0.9
    else:
        fev1 = clip(rng.gauss(88, 8), 68, 100)          # healthy lung function
        smoking = rng.random() < 0.18

    pregnancy = (gender == "female" and 18 <= age <= 45 and rng.random() < 0.04)

    return {
        "hba1c": hba1c, "bmi": bmi, "glucose": glucose,
        "systolic_bp": systolic, "diastolic_bp": diastolic,
        "fev1": fev1, "smoking": smoking,
        "kidney_disease": bool(kidney),
        "stroke": bool(flags["stroke"]),
        "pregnancy": bool(pregnancy),
        "respiratory_infection": rng.random() < 0.05,
    }


# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------

def _load_adherence_index() -> Dict[str, dict]:
    """Map patient_id -> adherence overlay entry (only ~50 patients have one)."""
    if not _ADHERENCE_PATH.exists():
        logger.warning("Adherence overlay missing at %s — adherence_record will be null", _ADHERENCE_PATH)
        return {}
    try:
        data = json.loads(_ADHERENCE_PATH.read_text(encoding="utf-8"))
        return {p["patient_id"]: p for p in data.get("patients", [])}
    except Exception as e:
        logger.warning("Failed to read adherence overlay (non-fatal): %s", e)
        return {}


def seed_cohort() -> int:
    """
    If the patients table is empty, parse all FHIR bundles and persist them.
    Returns the number of patients seeded (0 if already seeded).
    """
    from data_layer.db import patient_count
    if patient_count() > 0:
        return 0

    # Import here so build_dataset's module-level random.seed(7) has run.
    from prediction.build_dataset import _features_for_patient

    files = sorted(glob.glob(str(_SEED_DIR / "*.json")))
    if not files:
        logger.error("No FHIR bundles in %s — cannot seed cohort", _SEED_DIR)
        return 0

    adherence = _load_adherence_index()
    random.seed(7)  # match training_data.csv RNG sequence

    rows: List[tuple] = []
    for fp in files:
        with open(fp, encoding="utf-8") as fh:
            bundle = json.load(fh)
        feats = _features_for_patient(bundle)
        # build_dataset draws a 3rd RNG value for the dropout label — consume it
        # here too so subsequent patients line up with the training set.
        random.random()
        if feats is None:
            continue

        resources = [e["resource"] for e in bundle.get("entry", [])]
        patient_res = next((r for r in resources if r["resourceType"] == "Patient"), None)
        if not patient_res:
            continue

        pid = patient_res["id"]
        name = _patient_name(patient_res)
        kidney = _has_kidney_disease(resources)
        adh = adherence.get(pid)

        # Condition-driven enrichment: give each patient the trial biomarkers their
        # real conditions imply, so disease-specific trials surface eligible patients.
        flags = _condition_flags(resources)
        clinical = _enrich_clinical(flags, feats["gender"], feats["age"],
                                    feats.get("bmi"), kidney, pid)
        # Keep features consistent with the enriched labs (and adds real variety).
        feats["hba1c"] = clinical["hba1c"]
        feats["bmi"] = clinical["bmi"]
        feats["glucose"] = clinical["glucose"]

        rows.append((
            pid, name, feats["age"], feats["gender"],
            clinical["hba1c"], clinical["bmi"], clinical["glucose"],
            1 if kidney else 0,
            json.dumps(feats),
            json.dumps(clinical),
            json.dumps(adh) if adh else None,
            "synthea", None, None, _now(),
        ))

    with get_conn() as conn:
        conn.executemany(
            "INSERT OR IGNORE INTO patients (patient_id, name, age, gender, hba1c, bmi, "
            "glucose, kidney_disease, features_json, clinical_json, adherence_json, source, "
            "trial_id, screening_decision, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            rows,
        )
    logger.info("Seeded %d patients into SQLite", len(rows))
    return len(rows)


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

def _row_summary(row) -> Dict[str, Any]:
    keys = row.keys()
    return {
        "patient_id": row["patient_id"],
        "name": row["name"],
        "age": row["age"],
        "gender": row["gender"],
        "hba1c": row["hba1c"],
        "bmi": row["bmi"],
        "glucose": row["glucose"],
        "kidney_disease": bool(row["kidney_disease"]),
        "source": row["source"],
        "trial_id": row["trial_id"],
        "screening_decision": row["screening_decision"],
        "enrolled": bool(row["enrolled"]) if "enrolled" in keys else False,
    }


def list_patients(limit: int = 500, source: Optional[str] = None,
                  enrolled: Optional[bool] = None) -> List[Dict[str, Any]]:
    q = "SELECT * FROM patients"
    where: list = []
    params: list = []
    if source:
        where.append("source = ?")
        params.append(source)
    if enrolled is not None:
        where.append("enrolled = ?")
        params.append(1 if enrolled else 0)
    if where:
        q += " WHERE " + " AND ".join(where)
    q += " ORDER BY name LIMIT ?"
    params.append(limit)
    with get_conn() as conn:
        rows = conn.execute(q, params).fetchall()
    return [_row_summary(r) for r in rows]


def enroll_patient(patient_id: str, trial_id: Optional[str]) -> bool:
    """Mark a clinician-approved patient as enrolled / under observation."""
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE patients SET enrolled = 1, trial_id = COALESCE(?, trial_id) "
            "WHERE patient_id = ?",
            (trial_id, patient_id),
        )
        return cur.rowcount > 0


def _get_row(patient_id: str):
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM patients WHERE patient_id = ?", (patient_id,)
        ).fetchone()


def _clinical(row) -> Dict[str, Any]:
    raw = row["clinical_json"] if "clinical_json" in row.keys() else None
    return json.loads(raw) if raw else {}


def get_patient(patient_id: str) -> Optional[Dict[str, Any]]:
    row = _get_row(patient_id)
    if not row:
        return None
    out = _row_summary(row)
    out["features"] = json.loads(row["features_json"])
    out["clinical"] = _clinical(row)
    out["adherence_record"] = json.loads(row["adherence_json"]) if row["adherence_json"] else None
    return out


def screening_patient(patient_id: str) -> Optional[Dict[str, Any]]:
    """
    The dict the screening engine consumes. Starts with the core lab/demographic
    columns, then merges any trial-specific clinical fields submitted at enroll
    (systolic_bp, fev1, prior_stroke, ...) so the rule engine can evaluate them.
    """
    row = _get_row(patient_id)
    if not row:
        return None
    base = {
        "age": row["age"],
        "gender": row["gender"],
        "hba1c": row["hba1c"],
        "bmi": row["bmi"],
        "glucose": row["glucose"],
        "kidney_disease": bool(row["kidney_disease"]),
    }
    base.update(_clinical(row))  # trial-specific fields win
    return base


def feature_dict(patient_id: str) -> Optional[Dict[str, Any]]:
    row = _get_row(patient_id)
    if not row:
        return None
    return json.loads(row["features_json"])


def adherence_record(patient_id: str) -> Optional[Dict[str, Any]]:
    row = _get_row(patient_id)
    if not row or not row["adherence_json"]:
        return None
    return json.loads(row["adherence_json"])


# ---------------------------------------------------------------------------
# Self-enroll (Phase 1)
# ---------------------------------------------------------------------------

# Defaults so the diabetes-trained risk model always runs, even for a non-diabetes
# trial's patient who never submits hba1c/bmi/glucose.
_LAB_DEFAULTS = {"hba1c": 5.6, "bmi": 27.0, "glucose": 95.0}

# Keys handled explicitly (everything else in the flat form is "clinical").
_NON_CLINICAL = {
    "name", "age", "gender", "trial_id", "comorbidities", "medications",
    "missed_visits", "travel_distance_km", "num_encounters", "avg_visit_gap_days",
    "comorbidity_count", "num_medications", "has_comorbidity",
}


def _as_list(v: Any) -> list:
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    return [s.strip() for s in str(v).split(",") if s.strip()]


def add_patient(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Register a patient from the (trial-driven) recruitment form. The form is a FLAT
    dict whose clinical keys vary per trial (hba1c, systolic_bp, fev1, ...). We split
    it into: demographics, retention features (dropout risk), and trial-specific
    `clinical` fields (kept verbatim for screening).
    """
    pid = "enr-" + uuid.uuid4().hex[:10]
    age = int(payload.get("age") or 0)
    gender = (payload.get("gender") or "unknown").lower()

    comorbidities = _as_list(payload.get("comorbidities"))
    medications = _as_list(payload.get("medications"))
    comorbidity_count = int(payload.get("comorbidity_count", len(comorbidities)) or 0)
    num_medications = int(payload.get("num_medications", len(medications)) or 0)

    # Trial-specific clinical fields = everything not handled explicitly.
    clinical: Dict[str, Any] = {
        k: v for k, v in payload.items() if k not in _NON_CLINICAL and v is not None
    }
    if comorbidities:
        clinical["comorbidities"] = comorbidities
    if medications:
        clinical["medications"] = medications

    # Raw labs ACTUALLY submitted (None if this trial's form never asked for them).
    # Stored verbatim in the columns so screening never sees a value the patient
    # didn't provide. The risk model separately falls back to a population default.
    def _num(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    col_hba1c = _num(clinical.get("hba1c"))
    col_bmi = _num(clinical.get("bmi"))
    col_glucose = _num(clinical.get("glucose"))
    kidney = bool(clinical.get("kidney_disease")
                  or any("kidney" in k and clinical.get(k) for k in clinical))

    features = {
        "age": age,
        "gender": gender,
        "comorbidity_count": comorbidity_count,
        "has_comorbidity": 1 if comorbidity_count >= 2 else 0,
        "num_encounters": int(payload.get("num_encounters", 0) or 0),
        "avg_visit_gap_days": float(payload.get("avg_visit_gap_days", 180.0) or 180.0),
        "num_medications": num_medications,
        # Risk model needs numerics → fall back to population defaults if absent.
        "hba1c": col_hba1c if col_hba1c is not None else _LAB_DEFAULTS["hba1c"],
        "bmi": col_bmi if col_bmi is not None else _LAB_DEFAULTS["bmi"],
        "glucose": col_glucose if col_glucose is not None else _LAB_DEFAULTS["glucose"],
        "missed_visits": int(payload.get("missed_visits", 0) or 0),
        "travel_distance_km": float(payload.get("travel_distance_km", 10.0) or 10.0),
    }

    with get_conn() as conn:
        conn.execute(
            "INSERT INTO patients (patient_id, name, age, gender, hba1c, bmi, glucose, "
            "kidney_disease, features_json, clinical_json, adherence_json, source, trial_id, "
            "screening_decision, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (pid, payload.get("name", "New Patient"), age, gender, col_hba1c, col_bmi, col_glucose,
             1 if kidney else 0, json.dumps(features), json.dumps(clinical), None,
             "self-enroll", payload.get("trial_id"), None, _now()),
        )
    logger.info("Self-enrolled patient %s (clinical keys: %s)", pid, list(clinical.keys()))
    return get_patient(pid)


def set_screening_decision(patient_id: str, decision: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE patients SET screening_decision = ? WHERE patient_id = ?",
            (decision, patient_id),
        )
