"""
schemas/patient_schema.py
--------------------------
Pydantic models for patient-facing endpoints:
  - /screen-patient
  - /predict-risk
  - /fairness-audit
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Eligibility Screening
# ---------------------------------------------------------------------------

class EligibilityDecision(str, Enum):
    ELIGIBLE = "ELIGIBLE"
    INELIGIBLE = "INELIGIBLE"
    REQUIRES_REVIEW = "REQUIRES_REVIEW"


class CriteriaPayload(BaseModel):
    """Criteria block as returned by /extract-protocol."""

    inclusion: List[str] = Field(default_factory=list)
    exclusion: List[str] = Field(default_factory=list)


class ScreenPatientRequest(BaseModel):
    """Input to POST /screen-patient."""

    criteria: CriteriaPayload
    patient: Dict[str, Any] = Field(
        ...,
        description="Arbitrary patient data dictionary (demographics, labs, history, etc.).",
        examples=[{"age": 45, "hba1c": 7.2, "kidney_disease": False}],
    )


class ScreenPatientResponse(BaseModel):
    """Output from POST /screen-patient."""

    decision: EligibilityDecision
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: List[str] = Field(
        default_factory=list,
        description="Human-readable justifications for each criterion check.",
    )
    source_refs: List[str] = Field(
        default_factory=list,
        description="Dot-path references into the patient dict (e.g. 'demographics.age').",
    )


# ---------------------------------------------------------------------------
# Risk Prediction
# ---------------------------------------------------------------------------

class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RiskFeature(BaseModel):
    """A single SHAP explanation factor."""

    feature: str
    impact: float = Field(description="Signed SHAP value; positive = increases risk.")


class PredictRiskRequest(BaseModel):
    """Input to POST /predict-risk."""

    patient_features: Dict[str, Any] = Field(
        ...,
        description="Feature dictionary matching the columns used during training.",
        examples=[{"age": 45, "missed_visits": 3, "travel_distance_km": 45.0}],
    )


class PredictRiskResponse(BaseModel):
    """Output from POST /predict-risk."""

    risk_score: float = Field(ge=0.0, le=1.0)
    risk_level: RiskLevel
    top_factors: List[RiskFeature] = Field(
        default_factory=list,
        description="Top 5 SHAP factors driving the prediction.",
    )


# ---------------------------------------------------------------------------
# Cohort Screening (bulk — Tier 1: cheap path, rules + risk, NO LLM, NO audit)
# ---------------------------------------------------------------------------

class CohortPatient(BaseModel):
    """One patient in a bulk cohort-screen request."""

    patient_id: str
    name: Optional[str] = None
    patient: Dict[str, Any] = Field(
        ...,
        description="Patient data for rule-based screening (same shape as /screen-patient).",
    )
    patient_features: Dict[str, Any] = Field(
        default_factory=dict,
        description="Feature dict for the risk model (same shape as /predict-risk). "
                    "If empty/invalid, risk is marked unavailable for that patient.",
    )


class CohortScreenRequest(BaseModel):
    """Input to POST /screen-cohort — screen a whole cohort in one call."""

    criteria: CriteriaPayload
    patients: List[CohortPatient] = Field(..., min_length=1)


class CohortScreenResult(BaseModel):
    """Lightweight per-patient result (no evidence text, no SHAP, no LLM)."""

    patient_id: str
    name: Optional[str] = None
    decision: EligibilityDecision
    confidence: float = Field(ge=0.0, le=1.0)
    risk_score: Optional[float] = None
    risk_level: Optional[RiskLevel] = None
    risk_unavailable: bool = False


class CohortScreenResponse(BaseModel):
    """Output from POST /screen-cohort — ranked, eligible-first then by risk."""

    total: int
    summary: Dict[str, int] = Field(
        description="Counts by decision, e.g. {'ELIGIBLE': 12, 'INELIGIBLE': 30, 'REQUIRES_REVIEW': 8}."
    )
    results: List[CohortScreenResult]


# ---------------------------------------------------------------------------
# Fairness Audit
# ---------------------------------------------------------------------------

class FairnessAuditRequest(BaseModel):
    """Input to POST /fairness-audit."""

    patients: List[Dict[str, Any]] = Field(
        ...,
        min_length=1,
        description="List of patient dicts; each may contain 'gender', 'age', etc.",
    )


class FairnessAuditResponse(BaseModel):
    """Output from POST /fairness-audit."""

    total_patients: int
    gender_distribution: Dict[str, Any]
    age_distribution: Dict[str, Any]
    warnings: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
