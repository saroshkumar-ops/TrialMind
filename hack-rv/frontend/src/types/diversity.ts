// src/types/diversity.ts
// POST /api/fairness-audit

export interface DemographicBucket {
  label: string;
  count: number;
  percentage: number;
}

export interface FairnessAuditResponse {
  gender_distribution: DemographicBucket[];
  age_distribution: DemographicBucket[];
  warnings: string[];
  recommendations: string[];
}