"use client";
import { AdherenceDeviation, DeviationSeverity } from "@/types/adherence";
import { AlertTriangle, Clock } from "lucide-react";

interface DeviationAlertProps {
  deviation: AdherenceDeviation;
}

const SEV_CONFIG: Record<DeviationSeverity, { bg: string; border: string; color: string; pill: string }> = {
  CRITICAL: { bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.25)",  color: "#F87171", pill: "rgba(239,68,68,0.15)"  },
  HIGH:     { bg: "rgba(239,68,68,0.06)",  border: "rgba(239,68,68,0.18)",  color: "#F87171", pill: "rgba(239,68,68,0.12)"  },
  MEDIUM:   { bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.18)", color: "#FBBF24", pill: "rgba(245,158,11,0.12)" },
  LOW:      { bg: "rgba(96,165,250,0.06)", border: "rgba(96,165,250,0.18)", color: "#60A5FA", pill: "rgba(96,165,250,0.12)" },
};

export default function DeviationAlert({ deviation }: DeviationAlertProps) {
  const cfg = SEV_CONFIG[deviation.severity];
  const time = new Date(deviation.flagged_at).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="flex items-start gap-3.5 rounded-xl px-4 py-3.5 transition-all"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderLeft: `3px solid ${cfg.color}`,
      }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: cfg.pill }}>
        <AlertTriangle size={13} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{deviation.patient_name}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
            style={{ background: cfg.pill, border: `1px solid ${cfg.border}`, color: cfg.color }}>
            {deviation.severity}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            {deviation.type}
          </span>
        </div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{deviation.description}</p>
        <div className="flex items-center gap-1.5 mt-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
          <Clock size={10} />
          {time} · {deviation.patient_id}
        </div>
      </div>
    </div>
  );
}
