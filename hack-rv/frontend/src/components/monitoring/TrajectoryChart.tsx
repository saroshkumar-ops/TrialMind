"use client";
import { PastVisit } from "@/types/monitoring";
import { useMemo, useState } from "react";

interface TrajectoryChartProps {
  visits: PastVisit[];
}

type MetricKey = "hba1c" | "glucose" | "systolic_bp" | "heart_rate" | "weight";

const METRIC_CONFIG: Record<MetricKey, { label: string; min: number; max: number; unit: string; color: string; gradient: string }> = {
  hba1c:       { label: "HbA1c",       min: 4,   max: 12,  unit: "%",     color: "#2DD4BF", gradient: "linear-gradient(90deg, #2DD4BF, #0EA5E9)" },
  glucose:     { label: "Glucose",     min: 70,  max: 250, unit: "mg/dL", color: "#60A5FA", gradient: "linear-gradient(90deg, #60A5FA, #818CF8)" },
  systolic_bp: { label: "Systolic BP", min: 90,  max: 180, unit: "mmHg",  color: "#F87171", gradient: "linear-gradient(90deg, #F87171, #FB923C)" },
  heart_rate:  { label: "Heart Rate",  min: 50,  max: 120, unit: "bpm",   color: "#FBBF24", gradient: "linear-gradient(90deg, #FBBF24, #FB923C)" },
  weight:      { label: "Weight",      min: 40,  max: 150, unit: "kg",    color: "#A78BFA", gradient: "linear-gradient(90deg, #A78BFA, #C084FC)" },
};

export default function TrajectoryChart({ visits }: TrajectoryChartProps) {
  const [metric, setMetric] = useState<MetricKey>("hba1c");

  const sortedVisits = useMemo(() =>
    [...visits].sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime()),
    [visits]
  );

  const config = METRIC_CONFIG[metric];
  const width = 600; const height = 240;
  const paddingX = 44; const paddingY = 36;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = useMemo(() => {
    if (sortedVisits.length === 0) return [];
    const values = sortedVisits.map(v => v.vitals[metric] || 0);
    const actualMin = Math.min(...values);
    const actualMax = Math.max(...values);
    const rangeMin = Math.min(config.min, actualMin * 0.9);
    const rangeMax = Math.max(config.max, actualMax * 1.1);
    const range = rangeMax - rangeMin;
    return sortedVisits.map((visit, index) => {
      const val = visit.vitals[metric] || 0;
      const x = paddingX + (index / Math.max(sortedVisits.length - 1, 1)) * chartWidth;
      const y = paddingY + chartHeight - ((val - rangeMin) / range) * chartHeight;
      return { x, y, val, date: new Date(visit.visit_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) };
    });
  }, [sortedVisits, metric, config, chartWidth, chartHeight]);

  const pathD = points.length > 0 ? `M ${points.map(p => `${p.x},${p.y}`).join(" L ")}` : "";
  // Filled area
  const areaD = points.length > 0
    ? `M ${points[0].x},${height - paddingY} ${points.map(p => `L ${p.x},${p.y}`).join(" ")} L ${points[points.length - 1].x},${height - paddingY} Z`
    : "";

  return (
    <div className="rounded-2xl p-5 w-full"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Biomarker Trajectory</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Track physiological changes across visits</p>
        </div>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as MetricKey)}
          className="text-xs rounded-lg px-3 py-1.5 focus:outline-none transition-all"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          {Object.entries(METRIC_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label} ({v.unit})</option>
          ))}
        </select>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[480px] h-auto" style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id={`line-grad-${metric}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={config.color} />
              <stop offset="100%" stopColor={config.color} stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id={`area-grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={config.color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingY + chartHeight * ratio;
            return (
              <line key={ratio} x1={paddingX} y1={y} x2={width - paddingX} y2={y}
                stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 4" />
            );
          })}

          {/* Filled area */}
          {points.length > 1 && (
            <path d={areaD} fill={`url(#area-grad-${metric})`} />
          )}

          {/* Line */}
          {points.length > 1 && (
            <path d={pathD} fill="none" stroke={config.color} strokeWidth="2.5"
              style={{ filter: `drop-shadow(0 0 4px ${config.color}60)` }} />
          )}

          {/* Points & Labels */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="5" fill={config.color}
                style={{ filter: `drop-shadow(0 0 6px ${config.color}80)` }} />
              <circle cx={p.x} cy={p.y} r="2.5" fill="var(--bg-surface)" />
              <text x={p.x} y={p.y - 14} fill="var(--text-primary)" fontSize="11" fontWeight="700" textAnchor="middle"
                style={{ fontFamily: "Inter" }}>
                {p.val}
              </text>
              <text x={p.x} y={height - 10} fill="var(--text-muted)" fontSize="9" textAnchor="middle"
                style={{ fontFamily: "Inter" }}>
                {p.date}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Visit chips */}
      <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: "var(--text-muted)" }}>
          Visit Status
        </p>
        <div className="flex flex-wrap gap-2">
          {sortedVisits.map((v, i) => {
            const isAlert = v.monitoring_status === "alert";
            const isWatch = v.monitoring_status === "watch";
            return (
              <div key={v.visit_id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  background: isAlert ? "rgba(239,68,68,0.1)" : isWatch ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)",
                  border: `1px solid ${isAlert ? "rgba(239,68,68,0.2)" : isWatch ? "rgba(245,158,11,0.2)" : "rgba(34,197,94,0.2)"}`,
                  color: isAlert ? "#F87171" : isWatch ? "#FBBF24" : "#4ADE80",
                }}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                Visit {i + 1}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
