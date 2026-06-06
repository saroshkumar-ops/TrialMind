// src/lib/api/monitoringApi.ts

import { apiClient } from "./client";
import {
  SubmitVisitRequest,
  VisitAnalysisResponse,
  VisitTrajectoryResponse,
  VitalScenario,
  VitalsTick,
} from "@/types/monitoring";

// The backend visit/monitor response is richer than the UI needs — normalise it
// into VisitAnalysisResponse (string drivers, efficacy.summary, escalation.audit_id).
function mapVisit(raw: Record<string, unknown>): VisitAnalysisResponse {
  const safety = (raw.safety ?? {}) as Record<string, unknown>;
  const efficacy = (raw.efficacy ?? {}) as Record<string, unknown>;
  const dropout = (raw.dropout ?? {}) as Record<string, unknown>;
  const escalation = (raw.escalation ?? { escalated: false }) as Record<string, unknown>;

  return {
    patient_id: String(raw.patient_id ?? ""),
    visit_id: String(raw.visit_id ?? ""),
    monitoring_status: (raw.monitoring_status as VisitAnalysisResponse["monitoring_status"]) ?? "stable",
    safety: {
      is_anomaly: Boolean(safety.is_anomaly),
      drivers: safety.is_anomaly
        ? [String(safety.detail ?? "Anomalous reading detected")]
        : [],
    },
    efficacy: {
      status: (efficacy.status as VisitAnalysisResponse["efficacy"]["status"]) ?? "insufficient_data",
      pct_of_expected: Math.round(Number(efficacy.pct_of_expected ?? 0)),
      summary: String(efficacy.detail ?? ""),
    },
    dropout: {
      risk_level: (dropout.risk_level as "LOW" | "MEDIUM" | "HIGH") ?? "LOW",
      risk_score: Number(dropout.risk_score ?? 0),
    },
    escalation: {
      escalated: Boolean(escalation.escalated),
      reason: escalation.reason as string | undefined,
      severity: (String(escalation.severity ?? "").toUpperCase() ||
        undefined) as VisitAnalysisResponse["escalation"]["severity"],
      recommended_action: escalation.recommended_action as string | undefined,
      audit_id: raw.audit_id as string | undefined,
    },
  };
}

export const monitoringApi = {
  submitVisit: async (
    patientId: string,
    payload: SubmitVisitRequest
  ): Promise<VisitAnalysisResponse> => {
    const { data } = await apiClient.post(`/patients/${patientId}/visit`, payload);
    return mapVisit(data);
  },

  // One-click: stand-in for a live patient data feed (wearables / bedside devices).
  simulateVisit: async (
    patientId: string,
    trialId?: string
  ): Promise<VisitAnalysisResponse> => {
    const { data } = await apiClient.post(`/patients/${patientId}/simulate-visit`, {
      trial_id: trialId,
    });
    return mapVisit(data);
  },

  getVisits: async (patientId: string): Promise<VisitTrajectoryResponse> => {
    const { data } = await apiClient.get<VisitTrajectoryResponse>(
      `/patients/${patientId}/visits`
    );
    return data;
  },

  // One real-time bedside reading under a chosen scenario (live stream).
  vitalsTick: async (
    patientId: string,
    scenario: VitalScenario
  ): Promise<VitalsTick> => {
    const { data } = await apiClient.post<VitalsTick>(
      `/patients/${patientId}/vitals-tick`,
      { scenario }
    );
    return data;
  },
};
