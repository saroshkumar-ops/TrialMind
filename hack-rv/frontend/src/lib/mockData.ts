// src/lib/mockData.ts — aligned to Python AIML API shapes

import { ScreenCohortResponse, OrchestrateResponse } from "@/types/screening";
import { FairnessAuditResponse } from "@/types/diversity";
import { AdherenceResponse } from "@/types/adherence";
import { AuditTrailResponse } from "@/types/audit";
import { HITLReviewResponse } from "@/types/hitl";
import { ProtocolExtractResult } from "@/types/trial";
import { EnrollPatientResponse, PatientListResponse } from "@/types/patient";
import { VisitAnalysisResponse, VisitTrajectoryResponse } from "@/types/monitoring";

// ── Phase 0 ────────────────────────────────────────────────────────────────
export const MOCK_PROTOCOL: ProtocolExtractResult = {
  trial_id: "1",
  inclusion_criteria: [
    "Age 18–75 years",
    "HbA1c between 6.5% and 9.0%",
    "eGFR ≥ 45 mL/min/1.73m²",
    "BMI 18.5–40 kg/m²",
    "Type 2 diabetes diagnosis confirmed",
    "Willingness to attend monthly follow-up visits",
  ],
  exclusion_criteria: [
    "Active kidney disease or eGFR < 45",
    "Prior participation in any GLP-1 trial within 12 months",
    "Current insulin therapy",
    "Pregnancy or lactation",
    "Severe hepatic impairment (Child-Pugh C)",
  ],
  confidence: 0.94,
};

// ── Phase 1 ────────────────────────────────────────────────────────────────
export const MOCK_ENROLL_ELIGIBLE: EnrollPatientResponse = {
  patient_id: "p-self-001",
  name: "Demo Patient",
  screening_decision: "ELIGIBLE",
  screening_confidence: 0.89,
  screening_evidence: [
    "Age 42 satisfies 18–75 requirement",
    "HbA1c 7.4% within 6.5–9.0% range",
    "eGFR 68 mL/min ≥ 45 threshold",
    "BMI 27.2 within 18.5–40 range",
    "No disqualifying conditions detected",
  ],
  consent_required: true,
  message: "Patient is eligible. eConsent required before enrolment.",
};

export const MOCK_ENROLL_INELIGIBLE: EnrollPatientResponse = {
  patient_id: "p-self-002",
  name: "Demo Patient",
  screening_decision: "INELIGIBLE",
  screening_confidence: 0.93,
  screening_evidence: [
    "eGFR 28 mL/min is below the 45 mL/min threshold (EXCLUSION)",
    "HbA1c 7.2% within range",
    "Age 55 within range",
  ],
  consent_required: false,
  message: "Patient does not meet eligibility criteria for this trial.",
};

export const MOCK_PATIENT_LIST: PatientListResponse = {
  total: 4,
  patients: [
    { patient_id: "p-self-001", name: "Priya Sharma",    age: 42, gender: "female", hba1c: 7.4, bmi: 27.2, glucose: 138, kidney_disease: false, source: "self-enroll", screening_decision: "ELIGIBLE"        },
    { patient_id: "p-self-003", name: "Arjun Mehta",     age: 55, gender: "male",   hba1c: 8.1, bmi: 31.5, glucose: 160, kidney_disease: false, source: "self-enroll", screening_decision: "REQUIRES_REVIEW"  },
    { patient_id: "p-self-004", name: "Divya Nair",      age: 38, gender: "female", hba1c: 6.9, bmi: 24.0, glucose: 122, kidney_disease: false, source: "self-enroll", screening_decision: "ELIGIBLE"        },
    { patient_id: "p-self-005", name: "Rohan Gupta",     age: 67, gender: "male",   hba1c: 9.1, bmi: 33.2, glucose: 198, kidney_disease: true,  source: "self-enroll", screening_decision: "INELIGIBLE"      },
  ],
};

// ── Phase 2 ────────────────────────────────────────────────────────────────
export const MOCK_SCREEN_COHORT: ScreenCohortResponse = {
  trial_id: "1",
  total: 222,
  summary: { ELIGIBLE: 7, REQUIRES_REVIEW: 87, INELIGIBLE: 128 },
  results: [
    { patient_id: "p-001", name: "Elena Hartley",   decision: "ELIGIBLE",        confidence: 0.92, risk_level: "LOW",    risk_score: 0.18 },
    { patient_id: "p-002", name: "Ravi Kumar",       decision: "ELIGIBLE",        confidence: 0.87, risk_level: "MEDIUM", risk_score: 0.45 },
    { patient_id: "p-005", name: "Amara Mensah",     decision: "ELIGIBLE",        confidence: 0.95, risk_level: "LOW",    risk_score: 0.12 },
    { patient_id: "p-006", name: "Sofia Reyes",      decision: "ELIGIBLE",        confidence: 0.81, risk_level: "MEDIUM", risk_score: 0.51 },
    { patient_id: "p-007", name: "Liam O'Brien",     decision: "ELIGIBLE",        confidence: 0.79, risk_level: "HIGH",   risk_score: 0.72 },
    { patient_id: "p-008", name: "Chen Wei",         decision: "ELIGIBLE",        confidence: 0.88, risk_level: "LOW",    risk_score: 0.21 },
    { patient_id: "p-009", name: "Fatima Al-Hasan",  decision: "ELIGIBLE",        confidence: 0.84, risk_level: "MEDIUM", risk_score: 0.48 },
    { patient_id: "p-003", name: "Sara Teixeira",    decision: "REQUIRES_REVIEW", confidence: 0.61, risk_level: "MEDIUM", risk_score: 0.58 },
    { patient_id: "p-010", name: "Marcus Johnson",   decision: "REQUIRES_REVIEW", confidence: 0.54, risk_level: "HIGH",   risk_score: 0.76 },
    { patient_id: "p-011", name: "Yuki Tanaka",      decision: "REQUIRES_REVIEW", confidence: 0.67, risk_level: "MEDIUM", risk_score: 0.44 },
    { patient_id: "p-004", name: "James Park",       decision: "INELIGIBLE",      confidence: 0.95, risk_level: "HIGH",   risk_score: 0.97 },
    { patient_id: "p-012", name: "Nadia Okafor",     decision: "INELIGIBLE",      confidence: 0.91, risk_level: "HIGH",   risk_score: 0.88 },
  ],
};

export const MOCK_ORCHESTRATE: OrchestrateResponse = {
  patient_id: "p-004",
  screening_decision: "INELIGIBLE",
  screening_confidence: 0.95,
  screening_evidence: [
    { criterion: "eGFR ≥ 45 mL/min",         met: false, patient_value: "eGFR 28 mL/min",   source: "Lab 2026-03-11" },
    { criterion: "HbA1c between 6.5 and 9.0", met: true,  patient_value: "HbA1c 7.2",        source: "Lab 2026-02-18" },
    { criterion: "Age 18–75",                 met: false, patient_value: "Age 77",            source: "Patient record" },
    { criterion: "No active renal disease",   met: false, patient_value: "CKD Stage 3 noted", source: "Clinical notes" },
  ],
  eligibility_explanation:
    "Patient is ineligible due to renal exclusion — eGFR of 28 mL/min falls below the required threshold of 45 mL/min. Patient age (77) also exceeds the upper limit of 75. HbA1c is within range at 7.2.",
  risk_score: 0.97,
  risk_level: "HIGH",
  risk_top_factors: [
    { feature: "travel_distance_km",  impact:  2.16 },
    { feature: "missed_visits",       impact:  1.84 },
    { feature: "avg_visit_gap_days",  impact:  1.21 },
    { feature: "num_medications",     impact:  0.74 },
    { feature: "comorbidity_count",   impact:  0.51 },
    { feature: "age",                 impact: -0.32 },
    { feature: "bmi",                 impact: -0.18 },
  ],
  adherence_status: "2 consecutive scheduled visits missed",
  escalation: {
    escalated: true,
    reason: "HIGH dropout risk AND non-compliant adherence. Dual-agent trigger.",
    severity: "HIGH",
    recommended_action: "Immediate clinical review — retention intervention required.",
    audit_id: "audit-7b1e44f",
  },
  audit_id: "audit-7b1e44f",
};

// ── Dashboards ─────────────────────────────────────────────────────────────
export const MOCK_FAIRNESS: FairnessAuditResponse = {
  gender_distribution: [
    { label: "Male",   count: 171, percentage: 77 },
    { label: "Female", count: 43,  percentage: 19 },
    { label: "Other",  count: 8,   percentage: 4  },
  ],
  age_distribution: [
    { label: "18–39", count: 42, percentage: 20 },
    { label: "40–59", count: 88, percentage: 41 },
    { label: "60+",   count: 84, percentage: 39 },
  ],
  warnings: [
    "Cohort is 77% male — targeted female recruitment recommended",
    "Hispanic/Latino representation (12%) below target (20%)",
    "Under-45 age group underrepresented at 20% vs 30% target",
  ],
  recommendations: [
    "Target female-focused recruitment channels and community outreach",
    "Partner with community health centres in high-Hispanic neighbourhoods",
    "Consider flexible trial scheduling to improve younger-adult participation",
  ],
};

export const MOCK_ADHERENCE: AdherenceResponse = {
  deviations: [
    { id: "dev-001", patient_id: "p-004", patient_name: "James Park",     type: "Missed visit",  description: "2 consecutive scheduled visits missed — dropout risk elevated",     severity: "HIGH",   flagged_at: "2026-06-05T09:37:00Z" },
    { id: "dev-002", patient_id: "p-002", patient_name: "Ravi Kumar",     type: "Dose skipped",  description: "Morning dose not logged for 3 consecutive days",                    severity: "MEDIUM", flagged_at: "2026-06-05T08:10:00Z" },
    { id: "dev-003", patient_id: "p-003", patient_name: "Sara Teixeira",  type: "Late dose",     description: "Dose administered 6 hours outside protocol window",                 severity: "LOW",    flagged_at: "2026-06-04T21:00:00Z" },
    { id: "dev-004", patient_id: "p-010", patient_name: "Marcus Johnson", type: "Missed visit",  description: "Scheduled lab appointment not attended — 3rd missed in 90 days",    severity: "HIGH",   flagged_at: "2026-06-04T14:30:00Z" },
  ],
};

export const MOCK_AUDIT: AuditTrailResponse = {
  chain_valid: true,
  entries: [
    { id: "a-001", timestamp: "2026-06-05T09:41:00Z", type: "ESCALATION", agent: "Orchestrator",    description: "Escalation triggered — James Park flagged by Risk + Adherence agents", patient_id: "p-004", patient_name: "James Park",  hash: "a3f9c2d" },
    { id: "a-002", timestamp: "2026-06-05T09:40:00Z", type: "RISK",       agent: "Risk Agent",      description: "Dropout risk 0.97 scored — travel distance + missed visits primary drivers",                                                hash: "7b1e44f", patient_id: "p-004", patient_name: "James Park" },
    { id: "a-003", timestamp: "2026-06-05T09:38:00Z", type: "SCREENING",  agent: "Screening Agent", description: "Cohort screened: 7 ELIGIBLE, 87 REQUIRES_REVIEW, 128 INELIGIBLE (222 total)",                                              hash: "2c8da01" },
    { id: "a-004", timestamp: "2026-06-05T09:37:00Z", type: "ADHERENCE",  agent: "Adherence Agent", description: "HbA1c trending up — spike detected for James Park (↑11.2)",                   patient_id: "p-004", patient_name: "James Park",  hash: "f04ab78" },
    { id: "a-005", timestamp: "2026-06-05T09:30:00Z", type: "FAIRNESS",   agent: "Fairness Agent",  description: "Cohort gender imbalance detected — 77% male vs 50% target",                                                               hash: "d91e335" },
  ],
};

export const MOCK_HITL_RESPONSE: HITLReviewResponse = {
  success: true,
  message: "Review recorded successfully.",
};

// ── Phase 3: Active Monitoring ─────────────────────────────────────────────
export const MOCK_VISIT_ANALYSIS: VisitAnalysisResponse = {
  patient_id: "p-001",
  visit_id: "v-004",
  monitoring_status: "alert",
  safety: {
    is_anomaly: true,
    drivers: ["glucose spike (↑42%)", "systolic_bp elevated (148)"],
  },
  efficacy: {
    status: "below_expected",
    pct_of_expected: 45,
    summary: "HbA1c reduction is 0.2% vs expected 0.5% at month 4.",
  },
  dropout: {
    risk_level: "HIGH",
    risk_score: 0.82,
  },
  escalation: {
    escalated: true,
    reason: "Concurrent safety anomaly and high dropout risk detected.",
    severity: "HIGH",
    recommended_action: "Schedule immediate telehealth review. Consider adjusting dosage.",
    audit_id: "audit-v4-alert",
  },
};

export const MOCK_VISIT_TRAJECTORY: VisitTrajectoryResponse = {
  patient_id: "p-001",
  visits: [
    {
      visit_id: "v-001",
      visit_date: "2026-03-01T10:00:00Z",
      vitals: { heart_rate: 72, systolic_bp: 120, hba1c: 8.5, glucose: 150, weight: 85 },
      monitoring_status: "stable",
    },
    {
      visit_id: "v-002",
      visit_date: "2026-04-05T09:30:00Z",
      vitals: { heart_rate: 74, systolic_bp: 122, hba1c: 8.3, glucose: 145, weight: 84 },
      monitoring_status: "stable",
    },
    {
      visit_id: "v-003",
      visit_date: "2026-05-10T11:15:00Z",
      vitals: { heart_rate: 78, systolic_bp: 130, hba1c: 8.2, glucose: 160, weight: 84.5 },
      monitoring_status: "watch",
    },
    {
      visit_id: "v-004",
      visit_date: "2026-06-05T14:00:00Z",
      vitals: { heart_rate: 88, systolic_bp: 148, hba1c: 8.3, glucose: 210, weight: 83 },
      monitoring_status: "alert",
    },
  ],
};