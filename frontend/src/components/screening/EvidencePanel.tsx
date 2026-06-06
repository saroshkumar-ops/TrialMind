"use client";
import { useState } from "react";
import { OrchestrateResponse, ScreenedPatient } from "@/types/screening";
import { HITLAction } from "@/types/hitl";
import Badge from "@/components/ui/Badge";
import ScoreBar from "@/components/ui/ScoreBar";
import EvidenceAccordion from "@/components/ui/EvidenceAccordion";
import RiskDetailDrawer from "@/components/risk/RiskDetailDrawer";
import HITLBanner from "@/components/hitl/HITLBanner";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { X, CheckCircle2, UserCheck, Lock, FileSearch, TrendingUp } from "lucide-react";

interface EvidencePanelProps {
  patient: ScreenedPatient;
  data: OrchestrateResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onHITL: (action: HITLAction, reason?: string) => Promise<void>;
  hitlLoading: boolean;
  hitlRecorded: boolean;
  onApprove: () => Promise<void>;
  approveLoading: boolean;
  approveRecorded: boolean;
}

export default function EvidencePanel({
  patient, data, loading, error, onClose, onHITL, hitlLoading, hitlRecorded,
  onApprove, approveLoading, approveRecorded,
}: EvidencePanelProps) {
  const [tab, setTab] = useState<"evidence" | "risk">("evidence");

  return (
    <div className="flex flex-col h-full animate-slideInRight"
      style={{ borderLeft: "0.5px solid var(--border)", background: "var(--bg-surface)"}}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3.5 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
        <div>
          <p
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {patient.name}
          </p>

          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              letterSpacing: "0.05em",
            }}
          >
            {patient.patient_id}
          </p>
        </div>
        <button onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
          <X size={13} />
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner label="Running full pipeline…" />
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="p-4">
          <div className="rounded-xl px-4 py-3 text-sm text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {!loading && data && (
        <div className="flex-1 overflow-y-auto">
          {/* Decision strip */}
          <div className="px-4 py-3 flex-shrink-0"
            style={{
              borderRadius: 12,
              border: "0.5px solid var(--border)",
              padding: 16,
              background: "var(--bg-surface)"
            }}>
            <div
              style={{
                borderTop: "2.5px solid #185FA5",
                borderRadius: 12,
                border: "0.5px solid var(--border)",
                padding: 16,
              }}
            >
              <Badge variant="decision" value={data.screening_decision}>
                {data.screening_decision.replace("_", " ")}
              </Badge>
              <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                {Math.round(data.screening_confidence * 100)}% confidence
              </span>
            </div>
            <ScoreBar value={data.screening_confidence} colorScheme="confidence" height={3} showLabel={false} />
          </div>

          {/* Tabs */}
          <div className="flex flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            {([
              { key: "evidence", label: "Evidence", icon: <FileSearch size={13} /> },
              { key: "risk",     label: "Risk",     icon: <TrendingUp size={13} />  },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold uppercase tracking-widest transition-all"
                style={{
                  color: tab === t.key ? "var(--teal-400)" : "var(--text-muted)",
                  borderBottom: tab === t.key ? "2px solid var(--teal-400)" : "2px solid transparent",
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-4">
            {tab === "evidence" && (
              <>
                {/* Explanation */}
                <div className="rounded-xl px-4 py-3"
                  style={{ background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.12)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--teal-400)" }}>
                    AI Explanation
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {data.eligibility_explanation}
                  </p>
                </div>

                <EvidenceAccordion evidence={data.screening_evidence} />

                {data.escalation.escalated && (
                  <HITLBanner
                    escalation={data.escalation}
                    auditId={data.audit_id}
                    onSubmit={onHITL}
                    loading={hitlLoading}
                    recorded={hitlRecorded}
                  />
                )}

                {!data.escalation.escalated && data.screening_decision === "ELIGIBLE" && (
                  approveRecorded ? (
                    <div className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                      <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-green-400">Enrolled in Monitoring</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          Logged to audit trail · now under observation
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={onApprove}
                      disabled={approveLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 hover:opacity-90"
                      style={{ background: "linear-gradient(135deg, #0EA5E9, #06B6D4)", boxShadow: "0 0 20px rgba(14,165,233,0.3)" }}
                    >
                      {approveLoading
                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <UserCheck size={15} />}
                      Approve &amp; Enroll in Monitoring
                    </button>
                  )
                )}
              </>
            )}

            {tab === "risk" && <RiskDetailDrawer data={data} />}
          </div>
        </div>
      )}

      {/* Audit footer */}
      {data && (
        <div className="px-4 py-2 flex-shrink-0 flex items-center gap-1.5"
          style={{ borderTop: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
          <Lock size={10} style={{ color: "var(--text-muted)" }} />
          <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            Audit ref: {data.audit_id}
          </p>
        </div>
      )}
    </div>
  );
}
