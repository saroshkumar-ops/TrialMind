"""
monitoring/vitals_anomaly.py
----------------------------
Safety model — multivariate vital-sign anomaly detection (IsolationForest).

Train once on the cohort's vital panel; at inference, score a single reading.
Explainability: per-vital z-scores vs the cohort identify which vital(s) drive
the anomaly (the IsolationForest analogue of "reconstruction error per feature").

Artifacts (models/):
  anomaly_model.pkl  -> {"model", "scaler", "vital_order", "means", "stds",
                          "threshold", "trained_at", "n_samples"}
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import joblib
import numpy as np

from monitoring import VITAL_ORDER
from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

_MODEL_PATH = settings.models_dir / "anomaly_model.pkl"


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train(contamination: float = 0.02) -> Dict[str, Any]:
    """Train the IsolationForest on the cohort vitals matrix and persist it."""
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    from monitoring.build_vitals import build_vitals_matrix

    X, _ = build_vitals_matrix()
    scaler = StandardScaler().fit(X)
    Xs = scaler.transform(X)

    model = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        random_state=7,
    ).fit(Xs)

    # score_samples: higher = more normal. Use a low percentile as the anomaly cut.
    scores = model.score_samples(Xs)
    threshold = float(np.percentile(scores, contamination * 100))

    artifact = {
        "model": model,
        "scaler": scaler,
        "vital_order": VITAL_ORDER,
        "means": X.mean(axis=0).tolist(),
        "stds": (X.std(axis=0) + 1e-9).tolist(),
        "threshold": threshold,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_samples": int(X.shape[0]),
    }
    settings.models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, _MODEL_PATH)
    _State.artifact = artifact  # refresh cache so the new model is used immediately
    logger.info("Anomaly model trained on %d samples, threshold=%.4f", X.shape[0], threshold)
    return {"n_samples": int(X.shape[0]), "threshold": threshold, "vital_order": VITAL_ORDER}


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

class _State:
    artifact: Optional[dict] = None

    @classmethod
    def get(cls) -> Optional[dict]:
        if cls.artifact is None and _MODEL_PATH.exists():
            cls.artifact = joblib.load(_MODEL_PATH)
        return cls.artifact


def is_trained() -> bool:
    return _MODEL_PATH.exists()


def model_matches() -> bool:
    """True if a saved model exists AND was trained on the current VITAL_ORDER."""
    art = _State.get()
    return bool(art and art.get("vital_order") == VITAL_ORDER)


def score_reading(vitals: Dict[str, Any]) -> Dict[str, Any]:
    """
    Score a single vital reading.

    Returns: { trained, is_anomaly, anomaly_score (0..1, higher=worse),
               raw_score, threshold, drivers:[{vital, value, z}], detail }
    Missing vitals are imputed with the cohort mean (so partial readings still score).
    """
    art = _State.get()
    if art is None:
        return {"trained": False, "is_anomaly": False, "anomaly_score": None,
                "detail": "Anomaly model not trained. Run monitoring/train_anomaly.py."}

    order = art["vital_order"]
    means = art["means"]
    stds = art["stds"]

    x = []
    provided = {}
    for i, v in enumerate(order):
        val = vitals.get(v)
        if val is None:
            x.append(means[i])
        else:
            x.append(float(val))
            provided[v] = float(val)
    x = np.array([x], dtype=float)

    xs = art["scaler"].transform(x)
    raw = float(art["model"].score_samples(xs)[0])      # higher = normal
    is_anom = raw < art["threshold"]

    # Map raw score to 0..1 (higher = more anomalous) via a smooth squash around threshold.
    anomaly_score = float(1.0 / (1.0 + np.exp((raw - art["threshold"]) * 8.0)))

    # Per-vital z-scores (only for provided vitals) → drivers
    drivers: List[Dict[str, Any]] = []
    for i, v in enumerate(order):
        if v in provided:
            z = (provided[v] - means[i]) / stds[i]
            drivers.append({"vital": v, "value": provided[v], "z": round(z, 2)})
    drivers.sort(key=lambda d: abs(d["z"]), reverse=True)

    # Hard clinical safety bounds — an acute danger always flags, independent of the
    # population model (checked against ALL submitted vitals, not just the model vector).
    CLINICAL_LIMITS = [
        ("glucose", lambda x: x > 250, "critically high glucose"),
        ("heart_rate", lambda x: x > 130, "tachycardia"),
        ("heart_rate", lambda x: x < 40, "bradycardia"),
        ("systolic_bp", lambda x: x > 185, "hypertensive crisis"),
        ("hba1c", lambda x: x > 11, "very high HbA1c"),
        ("fev1", lambda x: x < 25, "severe airflow obstruction"),
    ]
    clinical_hit = None
    for key, test, label in CLINICAL_LIMITS:
        val = vitals.get(key)
        if val is not None and test(float(val)):
            clinical_hit = (key, float(val), label)
            break

    if clinical_hit:
        is_anom = True
        k, val, label = clinical_hit
        detail = f"Safety alert: {label} ({k}={val}). Immediate review."
    elif is_anom and drivers:
        top = drivers[0]
        direction = "above" if top["z"] > 0 else "below"
        detail = (f"Anomalous reading: {top['vital']}={top['value']} is "
                  f"{abs(top['z']):.1f}σ {direction} the cohort mean. Review recommended.")
    elif is_anom:
        detail = "Anomalous multivariate reading vs the cohort. Review recommended."
    else:
        detail = "Reading within normal cohort range."

    return {
        "trained": True,
        "is_anomaly": bool(is_anom),
        "anomaly_score": round(anomaly_score, 4),
        "raw_score": round(raw, 4),
        "threshold": round(art["threshold"], 4),
        "drivers": drivers,
        "detail": detail,
    }
