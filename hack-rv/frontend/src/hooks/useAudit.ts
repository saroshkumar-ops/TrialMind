// src/hooks/useAudit.ts
// Polls every 30s as per spec

import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api/auditApi";

export function useAuditTrail() {
  return useQuery({
    queryKey: ["audit-trail"],
    queryFn: auditApi.getAuditTrail,
    refetchInterval: 30_000,    // poll every 30s
    staleTime: 0,
  });
}