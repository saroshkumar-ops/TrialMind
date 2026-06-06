"use client";
import { ShapFactor } from "@/types/screening";
import { TrendingUp, TrendingDown } from "lucide-react";

interface DriverExplanationProps {
  factors: ShapFactor[];
}

export default function DriverExplanation({ factors }: DriverExplanationProps) {
  const max = Math.max(...factors.map((f) => Math.abs(f.impact)), 0.01);

  return (
    <div className="space-y-2.5">
      {factors.map((f, i) => {
        const pct = (Math.abs(f.impact) / max) * 100;
        const positive = f.impact > 0;
        const label = f.feature.replace(/_/g, " ");
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs w-32 truncate flex-shrink-0 text-right capitalize"
              style={{ color: "var(--text-secondary)" }}>
              {label}
            </span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: positive
                      ? "linear-gradient(90deg, #EF4444, #F87171)"
                      : "linear-gradient(90deg, #22C55E, #4ADE80)",
                    boxShadow: positive ? "0 0 6px rgba(239,68,68,0.4)" : "0 0 6px rgba(34,197,94,0.4)",
                    transition: `width ${300 + i * 60}ms cubic-bezier(.4,0,.2,1)`,
                  }}
                />
              </div>
              <div className="flex items-center gap-1 w-14">
                {positive
                  ? <TrendingUp size={10} className="text-red-400 flex-shrink-0" />
                  : <TrendingDown size={10} className="text-green-400 flex-shrink-0" />}
                <span className="text-xs font-mono font-bold"
                  style={{ color: positive ? "#F87171" : "#4ADE80" }}>
                  {positive ? "+" : ""}{f.impact.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      <p className="text-[10px] flex items-center gap-1.5 pt-1" style={{ color: "var(--text-muted)" }}>
        <TrendingUp size={9} className="text-red-400" /> increases risk ·
        <TrendingDown size={9} className="text-green-400" /> decreases risk (SHAP values)
      </p>
    </div>
  );
}
