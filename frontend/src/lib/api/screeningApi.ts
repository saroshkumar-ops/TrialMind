// src/lib/api/screeningApi.ts
// GET /trials/{id}/screen-cohort  — Tier 1 bulk screen
// POST /orchestrate               — Tier 2 single-patient full pipeline
import { apiClient } from "./client";
import { ScreenCohortResponse, OrchestrateResponse } from "@/types/screening";

export interface OrchestrateRequest {
  trial_id: string;
  actor: string;
}

export const screeningApi = {
  screenCohort: async (trialId: string): Promise<ScreenCohortResponse> => {
    const { data } = await apiClient.get<ScreenCohortResponse>(
      `/trials/${trialId}/screen-cohort`
    );
    return data;
  },

  orchestratePatient: async (
    patientId: string,
    payload: OrchestrateRequest
  ): Promise<OrchestrateResponse> => {
    const { data } = await apiClient.post<OrchestrateResponse>(
      `/orchestrate`,
      { patient_id: patientId, ...payload }
    );
    return data;
  },
};