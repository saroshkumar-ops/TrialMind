"""
schemas/orchestration_schema.py
---------------------------------
Pydantic models for the orchestration, HITL, and audit-trail endpoints:

  POST /orchestrate        → OrchestrationRequest / OrchestrationResponse
  POST /explain-eligibility → EligibilityExplanationRequest / EligibilityExplanationResponse
  POST /consent-summary    → ConsentSummaryRequest / ConsentSummaryResponse
  POST /hitl-review        → HITLReviewRequest / HITLReviewResponse
  GET  /audit-trail        → AuditTrailResponse
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Eligibility Explanation
# ---------------------------------------------------------------------------

class EligibilityExplanationRequest(BaseModel):
    criteria: Dict[str, List[str]] = Field(
        ...,
        description='Extracted criteria dict with "inclusion" and "exclusion" lists.',
        examples=[{"inclusion": ["Age 18–65", "HbA1c 6.5–9.0"], "exclusion": ["Kidney disease"]}],
    )
    patient: Dict[str, Any] = Field(
        ...,
        description="Patient data dict (same format as /screen-patient).",
        examples=[{"age": 45, "hba1c": 7.2, "kidney_disease": False}],
    )
    decision: str = Field(
        ...,
        description='Eligibility decision string: "ELIGIBLE", "INELIGIBLE", or "REQUIRES_REVIEW".',
        examples=["ELIGIBLE"],
    )


class EligibilityExplanationResponse(BaseModel):
    explanation: str = Field(description="2–4 sentence plain-English explanation of the decision.")
    decision: str
    generated_by: str = Field(default="groq-llm")


# ---------------------------------------------------------------------------
# Consent Summary
# ---------------------------------------------------------------------------

class ConsentSummaryRequest(BaseModel):
    protocol_text: str = Field(
        ...,
        min_length=10,
        description="Raw clinical trial protocol text to summarise for a patient.",
    )


class ConsentSummaryResponse(BaseModel):
    summary: str = Field(description="Plain-language patient-friendly summary (≤150 words).")
    word_count: int
    generated_by: str = Field(default="groq-llm")


# ---------------------------------------------------------------------------
# End-to-End Orchestration
# ---------------------------------------------------------------------------

class OrchestrationRequest(BaseModel):
    """Single call that chains protocol extraction → screening → risk → escalation."""

    protocol_text: str = Field(
        ...,
        min_length=10,
        description="Raw protocol text (will be passed through /extract-protocol internally).",
    )
    patient: Dict[str, Any] = Field(
        ...,
        description="Patient demographics, labs, history for screening.",
        examples=[{"age": 52, "hba1c": 7.8, "kidney_disease": False, "gender": "female"}],
    )
    patient_features: Dict[str, Any] = Field(
        ...,
        description="Feature dict for XGBoost risk model (same format as /predict-risk).",
        examples=[{"age": 52, "missed_visits": 2, "travel_distance_km": 60.0}],
    )
    adherence_record: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional adherence entry from adherence_overlay.json for this patient.",
    )
    patient_id: str = Field(
        default="unknown",
        description="Patient identifier for audit logging.",
    )
    actor: str = Field(
        default="orchestration_agent",
        description='Who or what triggered this orchestration (e.g. "system", "dr.jones").',
    )
    include_explanation: bool = Field(
        default=True,
        description="Whether to call Groq for a human-readable eligibility explanation.",
    )


class EscalationDetail(BaseModel):
    escalated: bool
    reason: str
    trigger_agents: List[str] = Field(default_factory=list)
    severity: str = "low"
    recommended_action: str = ""


class OrchestrationResponse(BaseModel):
    patient_id: str
    # Protocol extraction
    criteria: Dict[str, Any]
    protocol_confidence: float
    # Screening
    screening_decision: str
    screening_confidence: float
    screening_evidence: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Structured per-criterion evidence: {criterion, met, patient_value, source}.",
    )
    # Risk
    risk_score: Optional[float] = None
    risk_level: Optional[str] = None
    risk_top_factors: List[Dict[str, Any]] = Field(default_factory=list)
    risk_unavailable: bool = False
    # Escalation
    escalation: EscalationDetail
    # Explanation (optional, may be absent if Groq not configured or timed out)
    eligibility_explanation: Optional[str] = None
    # Audit
    audit_id: str = Field(description="ID of the audit trail entry for this orchestration run.")


# ---------------------------------------------------------------------------
# HITL Review
# ---------------------------------------------------------------------------

class HITLAction(str, Enum):
    APPROVE = "APPROVE"
    OVERRIDE = "OVERRIDE"
    ESCALATE = "ESCALATE"


class HITLReviewRequest(BaseModel):
    audit_id: str = Field(
        ...,
        description="The audit_id from an /orchestrate response that is being reviewed.",
    )
    action: HITLAction = Field(
        ...,
        description='"APPROVE" = clinician agrees with decision; '
                    '"OVERRIDE" = clinician reverses it; '
                    '"ESCALATE" = clinician escalates to senior review.',
    )
    actor: str = Field(
        ...,
        description='Clinician identifier, e.g. "dr.chen" or employee ID.',
        examples=["dr.chen"],
    )
    patient_id: str = Field(
        default="unknown",
        description="Patient identifier (for audit cross-reference).",
    )
    override_reason: Optional[str] = Field(
        default=None,
        description="Required when action=OVERRIDE. Documented clinical rationale.",
    )
    notes: Optional[str] = Field(
        default=None,
        description="Free-text notes attached to the review action.",
    )


class HITLReviewResponse(BaseModel):
    status: str = Field(description='"recorded" on success.')
    action: str
    actor: str
    review_audit_id: str = Field(description="New audit trail entry ID for this review action.")
    references_audit_id: str = Field(description="The original orchestration audit_id being reviewed.")


# ---------------------------------------------------------------------------
# Audit Trail
# ---------------------------------------------------------------------------

class AuditTrailResponse(BaseModel):
    total_entries: int
    chain_valid: bool
    chain_message: str
    entries: List[Dict[str, Any]] = Field(
        description="Audit entries, newest first.",
    )
