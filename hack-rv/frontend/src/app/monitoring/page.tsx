"use client";
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { usePatientList } from "@/hooks/usePatients";
import { usePatientVisits, useSimulateVisit } from "@/hooks/useMonitoring";
import { Patient } from "@/types/patient";
import { VisitAnalysisResponse } from "@/types/monitoring";
import { MOCK_PATIENT_LIST, MOCK_VISIT_ANALYSIS, MOCK_VISIT_TRAJECTORY } from "@/lib/mockData";
import { Activity, Search, Clock, ChevronRight, Radio, Target } from "lucide-react";
import MonitoringStatusPanel from "@/components/monitoring/MonitoringStatusPanel";
import TrajectoryChart from "@/components/monitoring/TrajectoryChart";
import LiveVitalsPanel from "@/components/monitoring/LiveVitalsPanel";

const USE_MOCK = false;

export default function MonitoringPage() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [tab, setTab] = useState<"live" | "treatment">("live");
  
  // Real data hooks — only CLINICIAN-APPROVED (enrolled) patients are under observation.
  const { data: realPatientsData, isLoading: isPatientsLoading } = usePatientList(undefined, true);
  const { data: realVisitsData, isLoading: isVisitsLoading } = usePatientVisits(selectedPatient?.patient_id || "");
  const simulateMutation = useSimulateVisit(selectedPatient?.patient_id || "");

  const enrolledPatients = USE_MOCK
    ? MOCK_PATIENT_LIST.patients.filter((p) => p.screening_decision === "ELIGIBLE")
    : (realPatientsData?.patients || []);

  const [mockAnalysis, setMockAnalysis] = useState<VisitAnalysisResponse | null>(null);
  const visitsTrajectory = USE_MOCK ? MOCK_VISIT_TRAJECTORY : realVisitsData;

  const handlePatientSelect = (p: Patient) => {
    setSelectedPatient(p);
    setMockAnalysis(null);
    simulateMutation.reset();
    setTab("live");
  };

  const handleSimulate = async () => {
    if (!selectedPatient) return;
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 900));
      setMockAnalysis(MOCK_VISIT_ANALYSIS);
    } else {
      await simulateMutation.mutateAsync(selectedPatient.trial_id);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-full animate-fadeInFast">
        {/* ── Left Pane ── */}
        <div className={`flex flex-col transition-all duration-300 ${selectedPatient ? "hidden md:flex md:w-[360px]" : "w-full"} min-w-0 flex-shrink-0`}
          style={{ borderRight: "1px solid var(--border)" }}>
          <div className="p-5 flex-shrink-0" style={{ background: "rgba(13,21,38,0.9)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}>
                <Activity size={18} style={{ color: "var(--purple-400)" }} />
              </div>
              <div>
                <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Active Monitoring</h1>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Enrolled patients in Phase 3</p>
              </div>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search patient..."
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg-base)" }}>
            {(!USE_MOCK && isPatientsLoading) ? (
              <div className="p-6 flex justify-center">
                <span className="w-5 h-5 rounded-full border-2 border-t-purple-400 animate-spin" style={{ borderColor: "rgba(167,139,250,0.2)", borderTopColor: "var(--purple-400)" }} />
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--border-muted)" }}>
                {enrolledPatients.map((p) => {
                  const active = selectedPatient?.patient_id === p.patient_id;
                  return (
                    <li key={p.patient_id}>
                      <button
                        onClick={() => handlePatientSelect(p)}
                        className="w-full flex items-center justify-between p-4 transition-all"
                        style={active ? {
                          background: "rgba(167,139,250,0.08)", borderLeft: "2px solid var(--purple-400)"
                        } : {
                          background: "transparent", borderLeft: "2px solid transparent"
                        }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <div className="text-left">
                          <p className="text-sm font-bold transition-colors" style={{ color: active ? "var(--purple-400)" : "var(--text-primary)" }}>
                            {p.name}
                          </p>
                          <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
                            ID: {p.patient_id}
                          </p>
                        </div>
                        <ChevronRight size={14} style={{ color: active ? "var(--purple-400)" : "var(--text-muted)" }} className="transition-all" />
                      </button>
                    </li>
                  );
                })}
                {enrolledPatients.length === 0 && (
                  <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No enrolled patients found.</div>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* ── Right Pane ── */}
        <div className={`flex-1 flex flex-col min-w-0 relative ${!selectedPatient ? "hidden md:flex" : "flex"}`} style={{ background: "var(--bg-surface)" }}>
          {!selectedPatient ? (
            <div className="flex-1 flex items-center justify-center flex-col animate-fadeIn">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.1)" }}>
                <Activity size={24} style={{ color: "var(--purple-400)" }} />
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Select an enrolled patient to monitor</p>
            </div>
          ) : (
            <div className="flex flex-col h-full animate-slideInRight">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{selectedPatient.name}</h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Age {selectedPatient.age} · {selectedPatient.gender} · <span className="font-mono">ID: {selectedPatient.patient_id}</span>
                  </p>
                </div>
                <button
                  className="md:hidden text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  onClick={() => setSelectedPatient(null)}
                >
                  Back
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-4 px-6 border-b border-[--border] bg-[--bg-surface]">
                <button
                  onClick={() => setTab("live")}
                  className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                    tab === "live" ? "border-teal-400 text-teal-300" : "border-transparent text-[--text-muted] hover:text-[--text-secondary]"
                  }`}
                >
                  <Radio size={16} /> Live Vitals <span className="text-[10px] text-[--text-muted]">(safety · real-time)</span>
                </button>
                <button
                  onClick={() => setTab("treatment")}
                  className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                    tab === "treatment" ? "border-teal-400 text-teal-300" : "border-transparent text-[--text-muted] hover:text-[--text-secondary]"
                  }`}
                >
                  <Target size={16} /> Treatment Response <span className="text-[10px] text-[--text-muted]">(efficacy · per visit)</span>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto space-y-6">
                  {tab === "live" && (
                    <LiveVitalsPanel
                      key={selectedPatient.patient_id}
                      patientId={selectedPatient.patient_id}
                      patientName={selectedPatient.name}
                    />
                  )}

                  {tab === "treatment" && (() => {
                    const analysis = (USE_MOCK ? mockAnalysis : simulateMutation.data) as VisitAnalysisResponse | null;
                    const simulating = USE_MOCK ? false : simulateMutation.isPending;
                    return (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between gap-3 bg-[--bg-surface] border border-[--border] rounded-xl p-4">
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-[--text-primary] flex items-center gap-2">
                              <Target size={15} className="text-teal-400" /> Treatment Response
                            </h3>
                            <p className="text-xs text-[--text-muted] mt-0.5">
                              Efficacy is a long-term signal. Advance the trial visit-by-visit to see whether the biomarker is trending toward the protocol target.
                            </p>
                          </div>
                          <button
                            onClick={handleSimulate}
                            disabled={simulating}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-teal-500 hover:bg-teal-600 text-white transition-colors disabled:opacity-60 flex-shrink-0"
                          >
                            {simulating ? (
                              <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Recording…
                              </>
                            ) : (
                              <>
                                <Clock size={14} />
                                {analysis ? "Advance Next Visit" : "Record First Visit"}
                              </>
                            )}
                          </button>
                        </div>

                        {analysis && (
                          <MonitoringStatusPanel
                            analysis={analysis}
                            onViewHistory={() => { /* trajectory shown below */ }}
                            onHITLSubmit={handleHITL}
                            hitlLoading={false}
                            hitlRecorded={false}
                          />
                        )}

                        {/* Biomarker trajectory across visits */}
                        {(!USE_MOCK && isVisitsLoading) ? (
                          <div className="py-8 text-center text-[--text-muted] animate-pulse">Loading trajectory…</div>
                        ) : visitsTrajectory?.visits && visitsTrajectory.visits.length > 0 ? (
                          <TrajectoryChart visits={visitsTrajectory.visits} />
                        ) : !analysis ? (
                          <div className="p-10 text-center bg-[--bg-surface] border border-dashed border-[--border] rounded-xl text-sm text-[--text-muted]">
                            Click <span className="text-teal-400 font-medium">Record First Visit</span> to begin tracking treatment response.
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
