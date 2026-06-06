// src/types/screening.ts — updated with richer ScreeningEvidence object

export type ScreeningDecision = "ELIGIBLE" | "INELIGIBLE" | "REQUIRES_REVIEW";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ScreeningEvidence {
  criterion: string;
  met: boolean;
  patient_value?: string;
  source?: string;
}

export interface ScreenedPatient {
  patient_id: string;
  name: string;
  decision: ScreeningDecision;
  confidence: number;
  risk_level: RiskLevel;
  risk_score?: number;
  risk_unavailable?: boolean;
}

export interface ScreenCohortSummary {
  ELIGIBLE: number;
  REQUIRES_REVIEW: number;
  INELIGIBLE: number;
}

export interface ScreenCohortResponse {
  trial_id: string;
  total: number;
  summary: ScreenCohortSummary;
  results: ScreenedPatient[];
}

export interface ShapFactor {
  feature: string;
  impact: number;
}

export interface Escalation {
  escalated: boolean;
  reason?: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommended_action?: string;
  audit_id?: string;
}

export interface OrchestrateResponse {
  patient_id: string;
  screening_decision: ScreeningDecision;
  screening_confidence: number;
  screening_evidence: ScreeningEvidence[];
  eligibility_explanation: string;
  risk_score: number;
  risk_level: RiskLevel;
  risk_top_factors: ShapFactor[];
  adherence_status?: string;
  escalation: Escalation;
  audit_id: string;
}