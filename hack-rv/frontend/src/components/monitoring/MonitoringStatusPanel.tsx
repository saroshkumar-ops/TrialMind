"use client";
import { VisitAnalysisResponse } from "@/types/monitoring";
import { HITLAction } from "@/types/hitl";
import HITLBanner from "@/components/hitl/HITLBanner";
import { ShieldAlert, AlertTriangle, CheckCircle2, Activity, TrendingUp, ArrowRight } from "lucide-react";

interface MonitoringStatusPanelProps {
  analysis: VisitAnalysisResponse;
  onViewHistory?: () => void;
  onHITLSubmit?: (action: HITLAction, reason?: string) => Promise<void>;
  hitlLoading?: boolean;
  hitlRecorded?: boolean;
}

export default function MonitoringStatusPanel({
  analysis,
  onViewHistory,
  onHITLSubmit,
  hitlLoading,
  hitlRecorded,
}: MonitoringStatusPanelProps) {
  const isAlert = analysis.monitoring_status === "alert";
  const isWatch = analysis.monitoring_status === "watch";

  const statusConfig = isAlert
    ? { color: "#F87171", glow: "rgba(239,68,68,0.15)", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", icon: <ShieldAlert size={24} className="text-red-400" /> }
    : isWatch
    ? { color: "#FBBF24", glow: "rgba(245,158,11,0.15)", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", icon: <AlertTriangle size={24} className="text-amber-400" /> }
    : { color: "#4ADE80", glow: "rgba(34,197,94,0.15)",  bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.2)",  icon: <CheckCircle2 size={24} className="text-green-400" /> };

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="flex items-center gap-4 rounded-2xl px-5 py-4"
        style={{ background: statusConfig.bg, border: `1px solid ${statusConfig.border}`, boxShadow: `0 0 24px ${statusConfig.glow}` }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${statusConfig.color}14`, border: `1px solid ${statusConfig.color}25` }}>
          {statusConfig.icon}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>
            Monitoring Status
          </p>
          <p className="text-xl font-bold uppercase tracking-wider" style={{ color: statusConfig.color }}>
            {analysis.monitoring_status}
          </p>
        </div>
      </div>

      {/* Safety + Efficacy grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Safety model */}
        <div className="rounded-2xl p-4"
          style={{ background: "var(--bg-surface)", border: `1px solid ${analysis.safety.is_anomaly ? "rgba(239,68,68,0.2)" : "var(--border)"}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} style={{ color: analysis.safety.is_anomaly ? "var(--red-400)" : "var(--teal-400)" }} />
            <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>Safety Model</h4>
          </div>
          {analysis.safety.is_anomaly ? (
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Anomaly Detected
              </span>
              <ul className="space-y-1">
                {analysis.safety.drivers.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <AlertTriangle size={11} className="text-red-400 flex-shrink-0 mt-0.5" /> {d}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-green-400 font-medium flex items-center gap-1.5">
              <CheckCircle2 size={12} /> No safety anomalies detected
            </p>
          )}
        </div>

        {/* Efficacy model */}
        <div className="rounded-2xl p-4"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} style={{ color: "var(--teal-400)" }} />
            <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>Efficacy Model</h4>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                analysis.efficacy.status === "on_track" ? "text-green-400" :
                analysis.efficacy.status === "above_expected" ? "text-teal-400" :
                "text-amber-400"
              }`}
              style={{ background: "rgba(255,255,255,0.06)" }}>
                {analysis.efficacy.status.replace("_", " ").toUpperCase()}
              </span>
              <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {Math.round(analysis.efficacy.pct_of_expected)}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(analysis.efficacy.pct_of_expected, 100)}%`,
                  background: analysis.efficacy.status === "on_track"
                    ? "linear-gradient(90deg, #22C55E, #4ADE80)"
                    : analysis.efficacy.status === "above_expected"
                    ? "linear-gradient(90deg, #0EA5E9, #06B6D4)"
                    : "linear-gradient(90deg, #F59E0B, #FBBF24)",
                }} />
            </div>
            <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
              {analysis.efficacy.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Escalation / HITL Banner */}
      {analysis.escalation?.escalated && onHITLSubmit && (
        <div className="mt-4">
          <HITLBanner
            escalation={analysis.escalation}
            auditId={analysis.escalation.audit_id || analysis.visit_id}
            onSubmit={onHITLSubmit}
            loading={hitlLoading}
            recorded={hitlRecorded}
          />
        </div>
      )}

      {onViewHistory && (
        <button
          onClick={onViewHistory}
          className="w-full flex items-center justify-center gap-2 py-3 mt-4 rounded-xl text-sm font-bold transition-all hover:bg-white/[0.05]"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        >
          View Vitals Trajectory <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
