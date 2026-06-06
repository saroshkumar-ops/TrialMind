// src/types/audit.ts
// GET /api/audit-trail

export type AuditEntryType =
  | "SCREENING"
  | "RISK"
  | "ESCALATION"
  | "HITL_APPROVE"
  | "HITL_OVERRIDE"
  | "HITL_ESCALATE"
  | "ADHERENCE"
  | "FAIRNESS";

export interface AuditEntry {
  id: string;
  timestamp: string;
  type: AuditEntryType;
  agent: string;
  description: string;
  patient_id?: string;
  patient_name?: string;
  hash?: string;
}

export interface AuditTrailResponse {
  chain_valid: boolean;         // true → 🔒 tamper-evident badge; false → red alert
  entries: AuditEntry[];
}