// src/lib/api/patientsApi.ts
// POST /patients   — self-enroll a patient + auto-screen
// GET  /patients   — patient registry list
import { apiClient } from "./client";
import {
  EnrollPatientRequest,
  EnrollPatientResponse,
  PatientListResponse,
} from "@/types/patient";

export const patientsApi = {
  enroll: async (payload: EnrollPatientRequest): Promise<EnrollPatientResponse> => {
    const { data } = await apiClient.post<EnrollPatientResponse>("/patients", payload);
    return data;
  },

  getAll: async (source?: string, enrolled?: boolean): Promise<PatientListResponse> => {
    const params: Record<string, string | boolean> = {};
    if (source) params.source = source;
    if (enrolled !== undefined) params.enrolled = enrolled;
    const { data } = await apiClient.get<PatientListResponse>("/patients", {
      params: Object.keys(params).length ? params : undefined,
    });
    return data;
  },

  // Clinician approves an eligible patient → enrolls into monitoring + audits it.
  enrollForMonitoring: async (
    patientId: string,
    trialId?: string,
    actor = "dr.chen"
  ): Promise<{ status: string; patient_id: string; trial_id?: string; audit_id: string }> => {
    const { data } = await apiClient.post(`/patients/${patientId}/enroll`, {
      trial_id: trialId,
      actor,
    });
    return data;
  },
};
