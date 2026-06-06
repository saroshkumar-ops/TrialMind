// src/hooks/useTrials.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trialsApi } from "@/lib/api/trialsApi";
import { CreateTrialDto } from "@/types/trial";

export const TRIALS_KEY = ["trials"];

export function useTrials() {
  return useQuery({
    queryKey: TRIALS_KEY,
    queryFn: trialsApi.getAll,
  });
}

export function useTrial(id: string) {
  return useQuery({
    queryKey: [...TRIALS_KEY, id],
    queryFn: () => trialsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTrialDto) => trialsApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: TRIALS_KEY }),
  });
}

export function useUploadProtocol() {
  return useMutation({
    mutationFn: ({ trialId, file }: { trialId: string; file: File }) =>
      trialsApi.uploadProtocol(trialId, file),
  });
}