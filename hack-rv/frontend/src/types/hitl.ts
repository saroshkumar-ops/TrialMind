// src/types/hitl.ts
// POST /api/hitl-review

export type HITLAction = "APPROVE" | "OVERRIDE" | "ESCALATE";

export interface HITLReviewRequest {
  audit_id: string;
  action: HITLAction;
  actor: string;
  override_reason?: string;   // required when action === "OVERRIDE"
}

export interface HITLReviewResponse {
  success: boolean;
  message: string;
}