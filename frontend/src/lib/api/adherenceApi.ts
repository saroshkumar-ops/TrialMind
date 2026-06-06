// src/lib/api/adherenceApi.ts
// GET /adherence-overlay
import { apiClient } from "./client";
import { AdherenceResponse } from "@/types/adherence";

export const adherenceApi = {
  getDeviations: async (): Promise<AdherenceResponse> => {
    const { data } = await apiClient.get<AdherenceResponse>("/adherence-overlay");
    return data;
  },
};