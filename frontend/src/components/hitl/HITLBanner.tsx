"use client";
import { useState } from "react";
import { Escalation } from "@/types/screening";
import { HITLAction } from "@/types/hitl";
import { AlertTriangle, CheckCircle2, ArrowUp, ShieldCheck } from "lucide-react";

interface HITLBannerProps {
  escalation: Escalation;
  auditId: string;
  onSubmit: (action: HITLAction, reason?: string) => Promise<void>;
  loading?: boolean;
  recorded?: boolean;
}

const ACTION_CONFIG: Record<HITLAction, { label: string; activeStyle: React.CSSProperties }> = {
  APPROVE:  { label: "Approve",  activeStyle: { background: "rgba(34,197,94,0.15)",   border: "1px solid rgba(34,197,94,0.35)",   color: "#4ADE80" } },
  OVERRIDE: { label: "Override", activeStyle: { background: "rgba(245,158,11,0.15)",  border: "1px solid rgba(245,158,11,0.35)",  color: "#FBBF24" } },
  ESCALATE: { label: "Escalate", activeStyle: { background: "rgba(239,68,68,0.15)",   border: "1px solid rgba(239,68,68,0.35)",   color: "#F87171" } },
};

export default function HITLBanner({ escalation, auditId, onSubmit, loading, recorded }: HITLBannerProps) {
  const [action, setAction] = useState<HITLAction | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);

  const handleSubmit = async () => {
    if (!action) return;
    if (action === "OVERRIDE" && !reason.trim()) { setReasonError(true); return; }
    setReasonError(false);
    await onSubmit(action, reason.trim() || undefined);
  };

  if (recorded) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
        <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-green-400">Review Recorded</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Logged to audit trail · Ref: {auditId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", boxShadow: "0 0 20px rgba(239,68,68,0.06)" }}>

      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid rgba(239,68,68,0.12)" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertTriangle size={16} className="text-red-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-red-400">Escalation Required</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)", color: "#F87171" }}>
              {escalation.severity ?? "HIGH"}
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{escalation.reason}</p>
          {escalation.recommended_action && (
            <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--amber-400)" }}>
              Recommended: {escalation.recommended_action}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3.5 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Clinician Action
        </p>
        <div className="flex flex-wrap gap-2">
          {(["APPROVE", "OVERRIDE", "ESCALATE"] as HITLAction[]).map((a) => {
            const cfg = ACTION_CONFIG[a];
            const isActive = action === a;
            return (
              <button
                key={a}
                onClick={() => { setAction(a); setReasonError(false); }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
                style={isActive ? cfg.activeStyle : {
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "var(--text-secondary)",
                }}
              >
                {a === "APPROVE"  && <CheckCircle2 size={12} />}
                {a === "OVERRIDE" && <ShieldCheck size={12} />}
                {a === "ESCALATE" && <ArrowUp size={12} />}
                {cfg.label}
              </button>
            );
          })}
        </div>

        {action === "OVERRIDE" && (
          <div>
            <textarea
              placeholder="Override reason (required)…"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setReasonError(false); }}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-xl resize-none focus:outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${reasonError ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.08)"}`,
                color: "var(--text-primary)",
              }}
            />
            {reasonError && <p className="text-xs text-red-400 mt-1">A reason is required for overrides.</p>}
          </div>
        )}

        {action && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #0EA5E9, #06B6D4)", boxShadow: "0 0 16px rgba(14,165,233,0.25)" }}
          >
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowUp size={14} />}
            Submit Review
          </button>
        )}
      </div>
    </div>
  );
}
