"""
prediction/predictor.py
------------------------
Module 4 — Risk Prediction API layer.

Loads the trained XGBoost model + preprocessor lazily at first request.
Gracefully returns an error dict when models are not yet trained.

Integrates with explainability/shap_explainer.py to attach top SHAP factors
to every prediction.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import numpy as np
import pandas as pd

from schemas.patient_schema import PredictRiskResponse, RiskFeature, RiskLevel
from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Risk thresholds
# ---------------------------------------------------------------------------
RISK_THRESHOLDS = {
    RiskLevel.LOW: 0.4,     # score < 0.40  → LOW
    RiskLevel.MEDIUM: 0.7,  # score < 0.70  → MEDIUM
    # else HIGH
}


def _score_to_level(score: float) -> RiskLevel:
    if score < RISK_THRESHOLDS[RiskLevel.LOW]:
        return RiskLevel.LOW
    if score < RISK_THRESHOLDS[RiskLevel.MEDIUM]:
        return RiskLevel.MEDIUM
    return RiskLevel.HIGH


# ---------------------------------------------------------------------------
# Lazy model loader
# ---------------------------------------------------------------------------

class ModelState:
    """Singleton container for the loaded model artifacts."""

    _instance: Optional["ModelState"] = None

    def __init__(self):
        self.model = None
        self.preprocessor = None
        self.feature_names: list[str] = []
        self.loaded: bool = False
        self.load_error: Optional[str] = None

    @classmethod
    def get(cls) -> "ModelState":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def try_load(self) -> bool:
        """
        Attempt to load model artifacts from disk.
        Returns True on success, False if files are missing.
        """
        if self.loaded:
            return True

        missing = []
        for path in (settings.risk_model_path, settings.preprocessor_path, settings.feature_names_path):
            if not path.exists():
                missing.append(str(path))

        if missing:
            self.load_error = f"Model not trained yet. Missing files: {missing}"
            logger.warning(self.load_error)
            return False

        try:
            self.model = joblib.load(settings.risk_model_path)
            self.preprocessor = joblib.load(settings.preprocessor_path)
            self.feature_names = joblib.load(settings.feature_names_path)
            self.loaded = True
            self.load_error = None
            logger.info(
                "Model loaded successfully. Features: %d, Classes: %s",
                len(self.feature_names),
                getattr(self.model, "classes_", "unknown"),
            )
            return True
        except Exception as e:
            self.load_error = f"Failed to load model: {e}"
            logger.error(self.load_error, exc_info=True)
            return False

    def invalidate(self) -> None:
        """Reset loader state so the next call re-reads from disk."""
        self.loaded = False
        self.model = None
        self.preprocessor = None
        self.feature_names = []
        self.load_error = None


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

def predict_risk(patient_features: Dict[str, Any]) -> PredictRiskResponse | Dict[str, str]:
    """
    Predict dropout/trial risk for a patient.

    Returns a PredictRiskResponse on success, or a dict with key "error"
    if the model is not yet trained.
    """
    state = ModelState.get()

    if not state.try_load():
        return {"error": state.load_error or "Model not trained yet"}

    try:
        # Build DataFrame aligned to training feature columns
        # Use only the raw features (pre-preprocessing) — preprocessor handles encoding
        input_df = pd.DataFrame([patient_features])

        # Apply the saved preprocessor
        X_transformed = state.preprocessor.transform(input_df)

        # Predict probability (class 1 = high risk / positive label)
        proba = state.model.predict_proba(X_transformed)
        risk_score = float(proba[0, 1]) if proba.shape[1] == 2 else float(proba[0].max())
        risk_level = _score_to_level(risk_score)

        logger.info("Predicted risk_score=%.4f, risk_level=%s", risk_score, risk_level)

        # SHAP explanations
        top_factors: list[RiskFeature] = []
        try:
            from explainability.shap_explainer import explain_prediction
            top_factors = explain_prediction(state, X_transformed)
        except Exception as shap_err:
            logger.warning("SHAP explanation failed (non-fatal): %s", shap_err)

        return PredictRiskResponse(
            risk_score=round(risk_score, 4),
            risk_level=risk_level,
            top_factors=top_factors,
        )

    except Exception as e:
        logger.error("Prediction error: %s", e, exc_info=True)
        return {"error": f"Prediction failed: {str(e)}"}


def get_model_info() -> Dict[str, Any]:
    """Return information about the currently loaded model."""
    state = ModelState.get()
    state.try_load()  # Attempt to load (no-op if already loaded)

    if not state.loaded:
        return {
            "status": "not_trained",
            "message": state.load_error or "Model not trained yet",
            "model_path": str(settings.risk_model_path),
        }

    model = state.model
    return {
        "status": "ready",
        "model_type": type(model).__name__,
        "n_features": len(state.feature_names),
        "feature_names": state.feature_names,
        "n_estimators": getattr(model, "n_estimators", None),
        "model_path": str(settings.risk_model_path),
        "risk_thresholds": {
            "LOW": f"score < {RISK_THRESHOLDS[RiskLevel.LOW]}",
            "MEDIUM": f"score < {RISK_THRESHOLDS[RiskLevel.MEDIUM]}",
            "HIGH": f"score ≥ {RISK_THRESHOLDS[RiskLevel.MEDIUM]}",
        },
    }
