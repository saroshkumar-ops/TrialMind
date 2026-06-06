// src/types/trial.ts

// One field in a trial's enrollment form (derived from the protocol criteria).
export interface EnrollField {
  key: string;
  label: string;
  type: "number" | "boolean" | "select" | "text";
  unit?: string;
  min?: number;
  max?: number;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  group: "demographic" | "clinical" | "retention";
  is_exclusion?: boolean;
  source_criterion?: string;
}

// Matches the Python /trials response.
export interface Trial {
  trial_id: string;
  name: string;
  protocol_text?: string;
  inclusion: string[];
  exclusion: string[];
  enroll_fields: EnrollField[];
  created_at?: string;
}

export interface CreateTrialDto {
  name: string;
  protocol_text?: string;
  inclusion?: string[];
  exclusion?: string[];
}

// POST /trials/{id}/protocol response (the updated trial).
export interface ProtocolExtractResult {
  trial_id: string;
  inclusion_criteria: string[];
  exclusion_criteria: string[];
  confidence?: number;
  enroll_fields?: EnrollField[];
}

// POST /consent-summary response
export interface ConsentSummary {
  trial_id: string;
  trial_name?: string;
  summary_text: string;
  generated_at?: string;
}
