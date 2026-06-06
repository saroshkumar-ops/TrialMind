// src/hooks/useAdherence.ts

import { useQuery } from "@tanstack/react-query";
import { adherenceApi } from "@/lib/api/adherenceApi";

export function useAdherence() {
  return useQuery({
    queryKey: ["adherence"],
    queryFn: adherenceApi.getDeviations,
    staleTime: 30_000,
  });
}