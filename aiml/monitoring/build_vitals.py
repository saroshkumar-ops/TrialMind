"""
monitoring/build_vitals.py
--------------------------
Extracts per-patient vital panels + biomarker time-series from the Synthea FHIR
bundles, for training the safety anomaly model and demoing the efficacy model.

  build_vitals_matrix() -> (X: np.ndarray [n_patients x 5], medians: dict)
       latest [hba1c, glucose, bmi, heart_rate, weight] per patient, median-imputed.

  patient_biomarker_series(patient_id, biomarker) -> [{date, value}, ...]
       the full chronological series for one patient/biomarker (for efficacy).
"""

from __future__ import annotations

import glob
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

from monitoring import VITAL_ORDER
from utils.config import settings

_SEED_DIR = settings.base_dir.parent / "data" / "seed" / "fhir"

LOINC = {
    "hba1c": "4548-4",
    "glucose": "2339-0",
    "bmi": "39156-5",
    "heart_rate": "8867-4",
    "weight": "29463-7",
}


def _series_from_bundle(bundle: dict, loinc_code: str) -> List[Tuple[str, float]]:
    out: List[Tuple[str, float]] = []
    for e in bundle.get("entry", []):
        r = e.get("resource", {})
        if r.get("resourceType") != "Observation":
            continue
        codes = [c.get("code") for c in r.get("code", {}).get("coding", [])]
        if loinc_code not in codes:
            continue
        vq = r.get("valueQuantity")
        dt = r.get("effectiveDateTime", "")
        if vq and "value" in vq and dt:
            out.append((dt[:10], float(vq["value"])))
    out.sort(key=lambda t: t[0])
    return out


def _latest(bundle: dict, loinc_code: str) -> Optional[float]:
    s = _series_from_bundle(bundle, loinc_code)
    return s[-1][1] if s else None


def _load_bundle_for_patient(patient_id: str) -> Optional[dict]:
    for fp in glob.glob(str(_SEED_DIR / "*.json")):
        if patient_id in Path(fp).name:
            return json.load(open(fp, encoding="utf-8"))
    # Fallback: scan bundles for the Patient.id (filenames embed it, so rarely needed)
    for fp in glob.glob(str(_SEED_DIR / "*.json")):
        b = json.load(open(fp, encoding="utf-8"))
        for e in b.get("entry", []):
            r = e.get("resource", {})
            if r.get("resourceType") == "Patient" and r.get("id") == patient_id:
                return b
    return None


def build_vitals_matrix() -> Tuple[np.ndarray, Dict[str, float]]:
    """
    Build the anomaly-training matrix from the ENRICHED cohort in SQLite (the values
    patients actually have), not raw FHIR — so the model's notion of "normal" matches
    the live data. Missing values are median-imputed.
    """
    from data_layer import registry
    pts = registry.list_patients(limit=100000, source="synthea")
    rows: List[List[Optional[float]]] = [[p.get(v) for v in VITAL_ORDER] for p in pts]

    arr = np.array(rows, dtype=float)  # None -> nan
    medians: Dict[str, float] = {}
    for j, v in enumerate(VITAL_ORDER):
        col = arr[:, j]
        med = float(np.nanmedian(col)) if not np.all(np.isnan(col)) else 0.0
        medians[v] = med
        col[np.isnan(col)] = med
        arr[:, j] = col
    return arr, medians


def patient_biomarker_series(patient_id: str, biomarker: str) -> List[Dict]:
    biomarker = biomarker.lower()
    if biomarker not in LOINC:
        return []
    bundle = _load_bundle_for_patient(patient_id)
    if not bundle:
        return []
    return [{"date": d, "value": v} for d, v in _series_from_bundle(bundle, LOINC[biomarker])]
