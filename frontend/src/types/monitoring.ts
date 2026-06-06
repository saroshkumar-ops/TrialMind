// src/types/monitoring.ts

import { Escalation } from "./screening";

export interface VisitVitals {
  heart_rate?: number;
  systolic_bp?: number;
  hba1c?: number;
  glucose?: number;
  weight?: number;
}

export interface SubmitVisitRequest {
  trial_id: string;
  visit_date: string;
  vitals: VisitVitals;
}

export interface VisitAnalysisResponse {
  patient_id: string;
  visit_id: string;
  monitoring_status: "stable" | "watch" | "alert";
  safety: {
    is_anomaly: boolean;
    drivers: string[];
  };
  efficacy: {
    status: "on_track" | "above_expected" | "below_expected" | "insufficient_data" | "unsupported";
    pct_of_expected: number;
    summary: string;
  };
  dropout: {
    risk_level: "LOW" | "MEDIUM" | "HIGH";
    risk_score: number;
  };
  escalation: Escalation;
}

export interface PastVisit {
  visit_id: string;
  visit_date: string;
  vitals: VisitVitals;
  monitoring_status: "stable" | "watch" | "alert";
}

export interface VisitTrajectoryResponse {
  patient_id: string;
  visits: PastVisit[];
}

// ---- Real-time live vitals stream ----
export type VitalScenario = "normal" | "moderate" | "critical";

export interface VitalsTick {
  patient_id: string;
  timestamp: string;
  scenario: VitalScenario;
  status: "stable" | "watch" | "critical";
  is_anomaly: boolean;
  vitals: Record<string, number>;
  units: Record<string, string>;
  vital_status: Record<string, "normal" | "warn" | "crit">;
  alerts: string[];
  detail: string;
  escalated: boolean;
  audit_id?: string;
}
