// src/hooks/useScreening.ts

import { useMutation, useQuery } from "@tanstack/react-query";
import { screeningApi } from "@/lib/api/screeningApi";

export function useScreenCohort(trialId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["screen-cohort", trialId],
    queryFn: () => screeningApi.screenCohort(trialId),
    enabled: enabled && !!trialId,
    staleTime: 60_000,
  });
}

type OrchestrateMutationInput = {
  patientId: string;
  trial_id: string;
  actor: string;
};

export function useOrchestratePatient() {
  return useMutation({
    mutationFn: ({ patientId, trial_id, actor }: OrchestrateMutationInput) =>
      screeningApi.orchestratePatient(patientId, { trial_id, actor }),
  });
}