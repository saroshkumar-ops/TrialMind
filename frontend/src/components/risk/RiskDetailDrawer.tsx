"use client";
import { OrchestrateResponse } from "@/types/screening";
import Badge from "@/components/ui/Badge";
import ScoreBar from "@/components/ui/ScoreBar";
import DriverExplanation from "./DriverExplanation";
import { AlertTriangle } from "lucide-react";

interface RiskDetailDrawerProps {
  data: OrchestrateResponse;
}

export default function RiskDetailDrawer({ data }: RiskDetailDrawerProps) {
  const riskColor = data.risk_score > 0.65 ? "#F87171" : data.risk_score > 0.35 ? "#FBBF24" : "#4ADE80";

  return (
    <div className="space-y-4">
      {/* Risk score header */}
      <div className="flex items-center gap-4 rounded-2xl px-5 py-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
            Dropout Risk Score
          </p>
          <p className="text-4xl font-bold leading-none" style={{ color: riskColor }}>
            {Math.round(data.risk_score * 100)}
            <span className="text-lg ml-0.5" style={{ color: "var(--text-muted)" }}>%</span>
          </p>
        </div>
        <Badge variant="risk" value={data.risk_level} className="text-sm px-3 py-1.5">
          {data.risk_level} RISK
        </Badge>
      </div>

      <ScoreBar value={data.risk_score} colorScheme="risk" height={6} />

      {/* Adherence status */}
      {data.adherence_status && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <AlertTriangle size={13} className="text-amber-400" />
          </div>
          <p className="text-sm text-amber-400 leading-snug">{data.adherence_status}</p>
        </div>
      )}

      {/* SHAP factors */}
      {data.risk_top_factors.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
            Risk Drivers (SHAP)
          </p>
          <DriverExplanation factors={data.risk_top_factors} />
        </div>
      )}
    </div>
  );
}
