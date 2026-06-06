// src/hooks/useDiversity.ts

import { useQuery } from "@tanstack/react-query";
import { diversityApi } from "@/lib/api/diversityApi";

export function useFairnessAudit() {
  return useQuery({
    queryKey: ["fairness-audit"],
    queryFn: diversityApi.getFairnessAudit,
    staleTime: 60_000,
  });
}