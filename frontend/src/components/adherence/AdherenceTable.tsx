"use client";
import { AdherenceResponse, DeviationSeverity } from "@/types/adherence";
import DeviationAlert from "./DeviationAlert";

interface AdherenceTableProps {
  data: AdherenceResponse;
}

const ORDER: DeviationSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const SEV_STYLE: Record<DeviationSeverity, { bg: string; border: string; color: string }> = {
  CRITICAL: { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.25)",  color: "#F87171" },
  HIGH:     { bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.18)",  color: "#F87171" },
  MEDIUM:   { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.18)", color: "#FBBF24" },
  LOW:      { bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.18)", color: "#60A5FA" },
};

export default function AdherenceTable({ data }: AdherenceTableProps) {
  const sorted = [...data.deviations].sort(
    (a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity)
  );

  const counts = data.deviations.reduce<Record<DeviationSeverity, number>>(
    (acc, d) => { acc[d.severity] = (acc[d.severity] ?? 0) + 1; return acc; },
    {} as Record<DeviationSeverity, number>
  );

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {(ORDER.filter((s) => counts[s]) as DeviationSeverity[]).map((s) => {
          const cfg = SEV_STYLE[s];
          return (
            <span key={s}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {counts[s]} {s}
            </span>
          );
        })}
      </div>

      {/* Alerts */}
      <div className="space-y-2">
        {sorted.map((d) => <DeviationAlert key={d.id} deviation={d} />)}
      </div>
    </div>
  );
}
