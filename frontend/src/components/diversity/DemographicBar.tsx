"use client";
import { DemographicBucket } from "@/types/diversity";

interface DemographicBarProps {
  buckets: DemographicBucket[];
  title: string;
}

const PALETTE = [
  { solid: "#0EA5E9", dim: "rgba(14,165,233,0.15)"  },
  { solid: "#2DD4BF", dim: "rgba(45,212,191,0.15)"  },
  { solid: "#A78BFA", dim: "rgba(167,139,250,0.15)" },
  { solid: "#FBBF24", dim: "rgba(251,191,36,0.15)"  },
  { solid: "#4ADE80", dim: "rgba(74,222,128,0.15)"  },
];

export default function DemographicBar({ buckets, title }: DemographicBarProps) {
  return (
    <div className="rounded-2xl p-5"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <p className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>{title}</p>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-5">
        {buckets.map((b, i) => {
          const pal = PALETTE[i % PALETTE.length];
          return (
            <div key={b.label}
              className="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${b.percentage}%`, background: pal.solid, boxShadow: `0 0 8px ${pal.solid}60` }}
              title={`${b.label}: ${b.percentage}%`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="space-y-2.5">
        {buckets.map((b, i) => {
          const pal = PALETTE[i % PALETTE.length];
          return (
            <div key={b.label} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: pal.solid, boxShadow: `0 0 6px ${pal.solid}60` }} />
              <span className="flex-1 text-sm" style={{ color: "var(--text-secondary)" }}>{b.label}</span>
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{b.count}</span>
              <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: `${b.percentage}%`, background: pal.solid, transition: "width .6s ease" }} />
              </div>
              <span className="text-xs font-bold w-8 text-right" style={{ color: pal.solid }}>{b.percentage}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
