"""
explainability/shap_explainer.py
---------------------------------
Module 5 — Explainability via SHAP.

Uses SHAP TreeExplainer to compute feature importance values for XGBoost.
Automatically adapts to whatever features were used during training.
No hardcoded feature names.

Returns top 5 features with signed SHAP impact values so that:
  - Positive impact  → increases predicted risk
  - Negative impact  → decreases predicted risk
"""

from __future__ import annotations

import numpy as np
import shap

from schemas.patient_schema import RiskFeature
from utils.logger import get_logger

logger = get_logger(__name__)

# Cache the explainer to avoid rebuilding on every request
_explainer_cache: dict = {}


def _get_explainer(model) -> shap.TreeExplainer:
    """
    Return a cached SHAP TreeExplainer for the given model.
    The cache key is the model's id() — resets naturally if a new model is loaded.
    """
    key = id(model)
    if key not in _explainer_cache:
        logger.info("Building SHAP TreeExplainer (model id=%d)…", key)
        _explainer_cache.clear()  # Evict any stale entry
        _explainer_cache[key] = shap.TreeExplainer(model)
        logger.info("SHAP TreeExplainer built successfully.")
    return _explainer_cache[key]


def explain_prediction(
    state,  # ModelState from predictor.py — avoid circular import
    X_transformed: np.ndarray,
    top_n: int = 5,
) -> list[RiskFeature]:
    """
    Compute SHAP values for the transformed input and return the top N features
    sorted by absolute impact.

    Args:
        state:         The loaded ModelState (contains model + feature_names).
        X_transformed: The preprocessed input array (shape: [1, n_features]).
        top_n:         Number of top features to return (default 5).

    Returns:
        List of RiskFeature with feature name and signed SHAP impact.
    """
    if not state.loaded or state.model is None:
        logger.warning("SHAP: model not loaded, skipping explanation.")
        return []

    try:
        explainer = _get_explainer(state.model)
        shap_values = explainer.shap_values(X_transformed)

        # For binary classification XGBoost, shap_values may be:
        #   - np.ndarray of shape [n_samples, n_features]  (single output)
        #   - list of two arrays (one per class) — take class-1 values
        if isinstance(shap_values, list):
            sv = shap_values[1][0]  # class 1 (positive / high risk)
        else:
            sv = shap_values[0]     # single output

        feature_names: list[str] = state.feature_names

        # Safety: align lengths
        n = min(len(sv), len(feature_names))
        sv = sv[:n]
        feature_names = feature_names[:n]

        # Sort by |impact| descending
        sorted_idx = np.argsort(np.abs(sv))[::-1]

        top_factors = []
        for i in sorted_idx[:top_n]:
            top_factors.append(
                RiskFeature(
                    feature=feature_names[i],
                    impact=round(float(sv[i]), 4),
                )
            )

        logger.info(
            "SHAP top features: %s",
            [(f.feature, f.impact) for f in top_factors],
        )
        return top_factors

    except Exception as e:
        logger.error("SHAP explanation error: %s", e, exc_info=True)
        return []


def invalidate_explainer_cache() -> None:
    """Clear the SHAP explainer cache (call when model is retrained)."""
    _explainer_cache.clear()
    logger.info("SHAP explainer cache cleared.")
