// src/lib/api/diversityApi.ts
// POST /fairness-audit
import { apiClient } from "./client";
import { FairnessAuditResponse } from "@/types/diversity";

export const diversityApi = {
  getFairnessAudit: async (): Promise<FairnessAuditResponse> => {
    const { data } = await apiClient.post<FairnessAuditResponse>("/fairness-audit");
    return data;
  },
};