"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ScreeningTable from "@/components/screening/ScreeningTable";
import EvidencePanel from "@/components/screening/EvidencePanel";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";
import { ScreenedPatient, OrchestrateResponse } from "@/types/screening";
import { Trial } from "@/types/trial";
import { HITLAction } from "@/types/hitl";
import { MOCK_SCREEN_COHORT, MOCK_ORCHESTRATE, MOCK_HITL_RESPONSE } from "@/lib/mockData";
import { RefreshCw, Zap, FlaskConical, Dna } from "lucide-react";

const USE_MOCK = false;
const ACTOR = "dr.chen";
const AIML_URL = process.env.NEXT_PUBLIC_AIML_URL ?? "http://localhost:8000";

export default function ScreeningPage() {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [trialId, setTrialId] = useState<string>("default-t2dm");

  const [cohortData, setCohortData] = useState(USE_MOCK ? MOCK_SCREEN_COHORT : null);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [cohortError, setCohortError] = useState<string | null>(null);
  const [screened, setScreened] = useState(USE_MOCK);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${AIML_URL}/trials`);
        const data: Trial[] = await res.json();
        setTrials(data);
        if (data.length) setTrialId((cur) => cur || data[0].trial_id);
      } catch (e) { console.error("Failed to load trials", e); }
    })();
  }, []);

  const [selectedPatient, setSelectedPatient] = useState<ScreenedPatient | null>(null);
  const [orchestrateData, setOrchestrateData] = useState<OrchestrateResponse | null>(null);
  const [orchestrateLoading, setOrchestrateLoading] = useState(false);
  const [orchestrateError, setOrchestrateError] = useState<string | null>(null);

  const [hitlLoading, setHitlLoading] = useState(false);
  const [hitlRecorded, setHitlRecorded] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveRecorded, setApproveRecorded] = useState(false);

  const runScreenCohort = async () => {
    setCohortLoading(true); setCohortError(null);
    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 1200));
        setCohortData(MOCK_SCREEN_COHORT);
      } else {
        const res = await fetch(`${AIML_URL}/trials/${trialId}/screen-cohort`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setCohortData(await res.json());
      }
      setScreened(true);
    } catch (e: unknown) { setCohortError(e instanceof Error ? e.message : "Failed to screen cohort"); }
    finally { setCohortLoading(false); }
  };

  const openPatient = async (patient: ScreenedPatient) => {
    setSelectedPatient(patient);
    setOrchestrateData(null); setOrchestrateError(null);
    setHitlRecorded(false); setApproveRecorded(false);
    setOrchestrateLoading(true);
    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 900));
        setOrchestrateData({ ...MOCK_ORCHESTRATE, patient_id: patient.patient_id });
      } else {
        const res = await fetch(`${AIML_URL}/patients/${patient.patient_id}/orchestrate`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trial_id: trialId, actor: ACTOR }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setOrchestrateData(await res.json());
      }
    } catch (e: unknown) { setOrchestrateError(e instanceof Error ? e.message : "Pipeline failed"); }
    finally { setOrchestrateLoading(false); }
  };

  const handleHITL = async (action: HITLAction, reason?: string) => {
    if (!orchestrateData) return;
    setHitlLoading(true);
    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 600));
      } else {
        await fetch(`${AIML_URL}/hitl-review`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audit_id: orchestrateData.audit_id, action, actor: ACTOR, override_reason: reason }),
        });
      }
      if (action === "APPROVE") await enrollForMonitoring();
      setHitlRecorded(true);
    } finally { setHitlLoading(false); }
  };

  const enrollForMonitoring = async () => {
    if (!selectedPatient) return;
    await fetch(`${AIML_URL}/patients/${selectedPatient.patient_id}/enroll`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trial_id: trialId, actor: ACTOR }),
    });
  };

  const handleApprove = async () => {
    if (!selectedPatient) return;
    setApproveLoading(true);
    try {
      await enrollForMonitoring();
      setApproveRecorded(true);
    } finally { setApproveLoading(false); }
  };

  return (
    <DashboardLayout>
      <div className="flex h-full animate-fadeInFast">
        {/* ── Left Panel ── */}
        <div
          className={`flex flex-col transition-all duration-300 ${
            selectedPatient ? "w-1/2" : "w-full"
          } min-w-0 flex-shrink-0`}
        >
          {/* Page Header */}
          <div
            className="px-12 py-6 flex-shrink-0"
            style={{
              background: "var(--bg-surface)",
              borderBottom: "0.5px solid var(--border)",
            }}
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                {/* Section Label */}
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: 10,
                  }}
                >
                  PATIENT ENROLLMENT
                </p>

                {/* Title */}
                <h1
                  style={{
                    fontFamily: "'Lora', Georgia, serif",
                    fontSize: 32,
                    fontWeight: 400,
                    lineHeight: 1.2,
                    color: "var(--text-primary)",
                  }}
                >
                  Participant Screening
                </h1>

                {/* Subtitle */}
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--text-muted)",
                    marginTop: 8,
                  }}
                >
                  Evaluate patient eligibility and enrollment readiness across the selected trial cohort.
                </p>

                {/* Trial Selection */}
                <div className="flex items-center gap-3 mt-5">
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                    }}
                  >
                    Trial Selection
                  </span>

                  <select
                    value={trialId}
                    onChange={(e) => {
                      setTrialId(e.target.value);
                      setScreened(false);
                      setCohortData(null);
                      setSelectedPatient(null);
                    }}
                    className="px-3 py-2 rounded-lg focus:outline-none"
                    style={{
                      background: "var(--bg-surface)",
                      border: "0.5px solid var(--border)",
                      color: "var(--text-primary)",
                      minWidth: 240,
                    }}
                  >
                    {trials.length === 0 && (
                      <option value="default-t2dm">default-t2dm</option>
                    )}

                    {trials.map((t) => (
                      <option key={t.trial_id} value={t.trial_id}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  <div
                    style={{
                      borderRadius: 999,
                      padding: "7px 14px",
                      background: "rgba(29,158,117,0.08)",
                      border: "0.5px solid rgba(29,158,117,0.18)",
                      color: "#1D9E75",
                      fontSize: 12,
                    }}
                  >
                    Tier 1 Screening
                  </div>
                </div>
              </div>

              <button
                onClick={runScreenCohort}
                disabled={cohortLoading}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
                style={{
                  background: "#1D9E75",
                  borderRadius: 8,
                }}
              >
                {cohortLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Screening...
                  </>
                ) : (
                  <>
                    {screened ? (
                      <RefreshCw size={14} />
                    ) : (
                      <Users size={14} />
                    )}
                    {screened ? "Re-screen Cohort" : "Screen Cohort"}
                  </>
                )}
              </button>
            </div>
          </div>

          {cohortError && (
            <ErrorBanner
              message={cohortError}
              className="mx-5 mt-4"
            />
          )}

          {!screened && !cohortLoading ? (
            <EmptyState
              icon={<Dna size={40} />}
              title="Ready to Screen"
              description="Run eligibility screening across the selected patient cohort."
              className="flex-1"
            />
          ) : cohortLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner
                size="lg"
                label="Running cohort screening..."
              />
            </div>
          ) : cohortData ? (
            <div
              className="flex-1 overflow-hidden"
              style={{
                background: "var(--bg-base)",
              }}
            >
              <ScreeningTable
                data={cohortData}
                selectedId={selectedPatient?.patient_id ?? null}
                onSelect={openPatient}
              />
            </div>
          ) : null}
        </div>

        {/* ── Right Panel ── */}
        {selectedPatient && (
          <div
            className="flex-1 min-w-0 overflow-hidden"
            style={{
              background: "var(--bg-surface)",
              borderLeft: "0.5px solid var(--border)",
            }}
          >
            <EvidencePanel
              patient={selectedPatient}
              data={orchestrateData}
              loading={orchestrateLoading}
              error={orchestrateError}
              onClose={() => setSelectedPatient(null)}
              onHITL={handleHITL}
              hitlLoading={hitlLoading}
              hitlRecorded={hitlRecorded}
              onApprove={handleApprove}
              approveLoading={approveLoading}
              approveRecorded={approveRecorded}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
import { Users } from "lucide-react";
