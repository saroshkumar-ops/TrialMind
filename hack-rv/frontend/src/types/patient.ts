// src/types/patient.ts
// Patient registry & enrollment types

import { ScreeningDecision } from "./screening";

export interface Patient {
  patient_id: string;
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  hba1c: number;
  bmi?: number;
  glucose?: number;
  kidney_disease?: boolean;
  source: "synthea" | "self-enroll" | "manual";
  screening_decision?: ScreeningDecision;
  trial_id?: string;
  enrolled?: boolean;
  enrolled_at?: string;
}

export interface EnrollPatientRequest {
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  hba1c: number;
  bmi?: number;
  glucose?: number;
  systolic_bp?: number;
  comorbidities?: string[];      // e.g. ["hypertension","CKD"]
  medications?: string[];        // e.g. ["metformin","lisinopril"]
  kidney_disease: boolean;
  trial_id?: string;
}

export interface EnrollPatientResponse {
  patient_id: string;
  name: string;
  screening_decision: ScreeningDecision;
  screening_confidence: number;
  screening_evidence?: string[];
  consent_required: boolean;    // true if ELIGIBLE → show eConsent
  message: string;
}

export interface PatientListResponse {
  total: number;
  patients: Patient[];
}

export interface ConsentSummary {
  trial_id: string;
  trial_name: string;
  summary_text: string;          // AI-generated plain-English consent summary
  inclusion_criteria: string[];
  exclusion_criteria: string[];
  generated_at: string;
}
