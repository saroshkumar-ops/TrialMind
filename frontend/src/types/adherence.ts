// src/types/adherence.ts
// GET /api/adherence

export type DeviationSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AdherenceDeviation {
  id: string;
  patient_id: string;
  patient_name: string;
  type: string;             // e.g. "Missed visit", "Dose skipped"
  description: string;
  severity: DeviationSeverity;
  flagged_at: string;
}

export interface AdherenceResponse {
  deviations: AdherenceDeviation[];
}