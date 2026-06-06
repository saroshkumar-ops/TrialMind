// src/lib/api/trialsApi.ts
// GET  /trials          — list trials
// GET  /trials/{id}     — get single trial
// POST /trials/{id}/protocol  — upload PDF, extract criteria
import { apiClient } from "./client";
import { Trial, CreateTrialDto, ProtocolExtractResult } from "@/types/trial";

export const trialsApi = {
  getAll: async (): Promise<Trial[]> => {
    const { data } = await apiClient.get<Trial[]>("/trials");
    return data;
  },

  getById: async (id: string): Promise<Trial> => {
    const { data } = await apiClient.get<Trial>(`/trials/${id}`);
    return data;
  },

  create: async (dto: CreateTrialDto): Promise<Trial> => {
    const { data } = await apiClient.post<Trial>("/trials", dto);
    return data;
  },

  // POST /trials/{id}/protocol — multipart PDF upload
  uploadProtocol: async (
    trialId: string,
    file: File
  ): Promise<ProtocolExtractResult> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post<ProtocolExtractResult>(
      `/trials/${trialId}/protocol`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  },
};