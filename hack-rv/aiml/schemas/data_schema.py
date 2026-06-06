"""
schemas/data_schema.py
-----------------------
Pydantic models for the data-layer endpoints that Python now owns (the frontend
talks directly to these — there is no Java backend):

  Trials:   POST /trials, GET /trials, GET /trials/{id}, POST /trials/{id}/protocol
  Patients: GET /patients, GET /patients/{id}, POST /patients (self-enroll)
  High-level: GET /trials/{id}/screen-cohort, POST /patients/{id}/orchestrate
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Trials
# ---------------------------------------------------------------------------

class TrialCreateRequest(BaseModel):
    name: str = Field(..., examples=["T2DM Glycemic Control Trial"])
    protocol_text: str = Field(default="")
    inclusion: List[str] = Field(default_factory=list)
    exclusion: List[str] = Field(default_factory=list)


class TrialResponse(BaseModel):
    trial_id: str
    name: str
    protocol_text: Optional[str] = None
    inclusion: List[str] = Field(default_factory=list)
    exclusion: List[str] = Field(default_factory=list)
    enroll_fields: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Trial-driven enrollment form schema (renders the patient form).",
    )
    created_at: str


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------

class PatientSummary(BaseModel):
    patient_id: str
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    hba1c: Optional[float] = None
    bmi: Optional[float] = None
    glucose: Optional[float] = None
    kidney_disease: bool = False
    source: str = "synthea"
    trial_id: Optional[str] = None
    screening_decision: Optional[str] = None
    enrolled: bool = False


class PatientDetail(PatientSummary):
    features: Dict[str, Any] = Field(default_factory=dict)
    clinical: Dict[str, Any] = Field(default_factory=dict)
    adherence_record: Optional[Dict[str, Any]] = None


class PatientListResponse(BaseModel):
    total: int
    patients: List[PatientSummary]


class SelfEnrollRequest(BaseModel):
    """
    Phase 1 recruitment form — a FLAT, trial-driven payload. Only name/age/gender are
    fixed; every other field is whatever the trial's `enroll_fields` schema asked for
    (hba1c, systolic_bp, fev1, kidney_disease, comorbidities, ...). Extra keys are
    accepted and treated as trial-specific clinical fields used for screening.
    """
    model_config = ConfigDict(extra="allow")

    name: str = Field(..., examples=["Jane Doe"])
    age: int = Field(..., ge=0, le=120)
    gender: str = Field(..., examples=["female"])
    trial_id: Optional[str] = Field(default=None, description="Trial to auto-screen against.")


class SelfEnrollResponse(BaseModel):
    patient: PatientDetail
    auto_screen: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Auto-screen result against trial_id if one was supplied.",
    )


# ---------------------------------------------------------------------------
# Single-patient orchestrate (high-level — payload assembled server-side)
# ---------------------------------------------------------------------------

class PatientOrchestrateRequest(BaseModel):
    trial_id: str = Field(..., description="Trial whose protocol_text + criteria to use.")
    actor: str = Field(default="clinician", examples=["dr.chen"])
    include_explanation: bool = True
