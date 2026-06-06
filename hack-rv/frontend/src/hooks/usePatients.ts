// src/hooks/usePatients.ts

import { useMutation, useQuery } from "@tanstack/react-query";
import { patientsApi } from "@/lib/api/patientsApi";
import { EnrollPatientRequest } from "@/types/patient";

export function usePatientList(source?: string, enrolled?: boolean) {
  return useQuery({
    queryKey: ["patients", source, enrolled],
    queryFn: () => patientsApi.getAll(source, enrolled),
    staleTime: 30_000,
  });
}

export function useEnrollPatient() {
  return useMutation({
    mutationFn: (payload: EnrollPatientRequest) => patientsApi.enroll(payload),
  });
}
