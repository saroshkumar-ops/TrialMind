"""
schemas/monitoring_schema.py
----------------------------
Pydantic models for Phase 3 active-monitoring endpoints:
  POST /monitoring/anomaly                 → AnomalyRequest / dict
  POST /monitoring/efficacy                → EfficacyRequest / dict
  POST /patients/{id}/visit                → RecordVisitRequest / VisitMonitorResponse
  GET  /patients/{id}/visits               → VisitListResponse
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class VitalsPayload(BaseModel):
    """A vital-sign reading. All optional; missing values are cohort-imputed."""
    hba1c: Optional[float] = None
    glucose: Optional[float] = None
    bmi: Optional[float] = None
    heart_rate: Optional[float] = None
    weight: Optional[float] = None

    def as_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.model_dump().items() if v is not None}


class AnomalyRequest(BaseModel):
    patient_id: str = Field(default="unknown")
    vitals: VitalsPayload


class EfficacyRequest(BaseModel):
    biomarker: str = Field(default="hba1c", examples=["hba1c"])
    series: List[Dict[str, Any]] = Field(
        ..., min_length=2,
        description='Chronological [{"date":"YYYY-MM-DD","value":float}, ...].',
        examples=[[{"date": "2025-01-01", "value": 8.4}, {"date": "2025-06-01", "value": 7.1}]],
    )
    adherence_rate: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    visit_count: Optional[int] = None


class RecordVisitRequest(BaseModel):
    trial_id: Optional[str] = None
    visit_date: str = Field(..., examples=["2026-03-01"])
    vitals: VitalsPayload
    biomarker: str = Field(default="hba1c", description="Biomarker tracked for efficacy.")
    actor: str = Field(default="clinician")


class VisitMonitorResponse(BaseModel):
    patient_id: str
    visit_id: str
    visit_date: str
    monitoring_status: str = Field(description='"stable" | "watch" | "alert"')
    safety: Dict[str, Any]
    efficacy: Dict[str, Any]
    dropout: Dict[str, Any]
    adherence_status: Optional[str] = None
    escalation: Dict[str, Any]
    audit_id: str


class VisitListResponse(BaseModel):
    patient_id: str
    total: int
    visits: List[Dict[str, Any]]


# ---------------------------------------------------------------------------
# Real-time vitals stream (Live Vitals)
# ---------------------------------------------------------------------------

class VitalsTickRequest(BaseModel):
    scenario: str = Field(default="normal", description='"normal" | "moderate" | "critical"')
    actor: str = "monitoring_agent"


class VitalsTickResponse(BaseModel):
    patient_id: str
    timestamp: str
    scenario: str
    status: str = Field(description='"stable" | "watch" | "critical"')
    is_anomaly: bool
    vitals: Dict[str, float]
    units: Dict[str, str]
    vital_status: Dict[str, str] = Field(description='per-vital severity: normal | warn | crit')
    alerts: List[str] = Field(default_factory=list)
    detail: str
    escalated: bool = False
    audit_id: Optional[str] = None
