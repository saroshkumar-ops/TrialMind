// src/lib/api/auditApi.ts
// GET /audit-trail
import { apiClient } from "./client";
import { AuditTrailResponse } from "@/types/audit";

export const auditApi = {
  getAuditTrail: async (): Promise<AuditTrailResponse> => {
    const { data } = await apiClient.get<AuditTrailResponse>("/audit-trail");
    return data;
  },
};