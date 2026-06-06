"""
monitoring/simulate.py
----------------------
Generate a realistic "next visit" vitals reading for an enrolled patient — so the
Active Monitoring demo works with one button instead of manual data entry.

The reading is BOTH trial-aware and patient-specific:
  - the trial's primary biomarker (HbA1c / Systolic BP / FEV1) continues the
    patient's own trajectory, trending toward improvement on treatment;
  - the safety panel (hba1c, glucose, bmi, heart_rate, weight) is carried forward
    from the patient's baseline / last visit with small noise;
  - ~1 in 5 visits injects a clinically dangerous spike (tachycardia + hyperglycaemia
    + biomarker worsening) so the safety model fires an alert.

Deterministic per (patient, visit index) so re-clicking is stable but advancing
visits varies.
"""

from __future__ import annotations

import random
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Tuple

# Per-visit improvement step for each biomarker (sign = direction of improvement).
_STEP = {
    "hba1c": -0.4, "glucose": -10.0, "bmi": -0.2, "weight": -0.8,
    "systolic_bp": -7.0, "diastolic_bp": -3.5, "fev1": +3.0,
}
_BASE_DATE = date(2026, 1, 8)
_VISIT_GAP_DAYS = 28


def primary_biomarker(trial: Dict[str, Any]) -> str:
    """The disease-defining biomarker a trial monitors for efficacy."""
    keys = [f["key"] for f in trial.get("enroll_fields", [])
            if f.get("group") == "clinical" and f.get("type") == "number"]
    for pref in ("fev1", "systolic_bp", "hba1c", "glucose", "bmi"):
        if pref in keys:
            return pref
    return "hba1c"


def _base(clinical: Dict[str, Any], features: Dict[str, Any],
          key: str, fallback: float) -> float:
    """Enrollment baseline value for a vital (clinical → features → fallback)."""
    for src in (clinical, features):
        v = src.get(key) if src else None
        if v is not None:
            try:
                return float(v)
            except (TypeError, ValueError):
                pass
    return fallback


def simulate_visit(patient: Dict[str, Any], trial: Dict[str, Any],
                   prior_visits: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], str, str]:
    """
    Returns (vitals, visit_date, biomarker). The trajectory is computed from the
    patient's ENROLLMENT baseline + visit index (cumulative improvement), so a
    transient spike on one visit never poisons later visits. A spike is an ACUTE
    event (hyperglycaemia + tachycardia) — it does NOT move the chronic biomarker,
    so efficacy stays clean while the safety model fires.
    """
    pid = patient["patient_id"]
    clinical = patient.get("clinical") or {}
    features = patient.get("features") or {}
    biomarker = primary_biomarker(trial)

    idx = len(prior_visits) + 1
    n = idx - 1  # how many treatment intervals have elapsed
    rng = random.Random(f"{pid}-sim-{idx}")
    visit_date = (_BASE_DATE + timedelta(days=n * _VISIT_GAP_DAYS)).isoformat()

    # Baselines (from enrollment), then apply cumulative improvement on the relevant signals.
    diabetic = _base(clinical, features, "hba1c", 5.6) >= 6.3
    hba1c = _base(clinical, features, "hba1c", 5.6)
    glucose = _base(clinical, features, "glucose", 95.0)
    bmi = _base(clinical, features, "bmi", 27.0)
    weight = round(bmi * 2.85, 1)
    systolic = _base(clinical, features, "systolic_bp", 125.0)
    diastolic = _base(clinical, features, "diastolic_bp", 80.0)
    fev1 = _base(clinical, features, "fev1", 85.0)

    def traj(base: float, key: str, floor: float = None, cap: float = None) -> float:
        v = base + _STEP[key] * n + rng.uniform(-0.2, 0.2) * abs(_STEP[key])
        if floor is not None:
            v = max(floor, v)
        if cap is not None:
            v = min(cap, v)
        return v

    # Chronic biomarkers trend toward improvement over visits.
    if diabetic:
        hba1c = traj(hba1c, "hba1c", floor=5.4)
        glucose = traj(glucose, "glucose", floor=85)
    if biomarker == "systolic_bp":
        systolic = traj(systolic, "systolic_bp", floor=118)
        diastolic = traj(diastolic, "diastolic_bp", floor=70)
    if biomarker == "fev1":
        fev1 = traj(fev1, "fev1", cap=82)

    spike = rng.random() < 0.20 and idx >= 2  # acute event; never on the first visit
    heart_rate = round(rng.uniform(143, 160)) if spike else round(rng.gauss(76, 4))
    if spike:
        glucose = round(rng.uniform(300, 360))   # acute hyperglycaemia (this visit only)

    vitals: Dict[str, Any] = {
        "hba1c": round(hba1c, 1),
        "glucose": round(glucose),
        "bmi": round(bmi, 1),
        "heart_rate": heart_rate,
        "weight": weight,
    }
    if biomarker == "systolic_bp" or "systolic_bp" in clinical:
        vitals["systolic_bp"] = round(systolic)
        vitals["diastolic_bp"] = round(diastolic)
    if biomarker == "fev1" or "fev1" in clinical:
        vitals["fev1"] = round(fev1, 1)

    return vitals, visit_date, biomarker
