// src/hooks/useMonitoring.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { monitoringApi } from "@/lib/api/monitoringApi";
import { SubmitVisitRequest } from "@/types/monitoring";

export function usePatientVisits(patientId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["visits", patientId],
    queryFn: () => monitoringApi.getVisits(patientId),
    enabled: enabled && !!patientId,
  });
}

export function useSubmitVisit(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SubmitVisitRequest) =>
      monitoringApi.submitVisit(patientId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visits", patientId] });
    },
  });
}

// One-click live-data simulation for an enrolled patient.
export function useSimulateVisit(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trialId?: string) => monitoringApi.simulateVisit(patientId, trialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visits", patientId] });
    },
  });
}
