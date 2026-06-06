"use client";
import { FairnessAuditResponse } from "@/types/diversity";
import DemographicBar from "./DemographicBar";
import FairnessFlag from "./FairnessFlag";
import { Lightbulb, AlertTriangle } from "lucide-react";

interface DiversityPanelProps {
  data: FairnessAuditResponse;
}

export default function DiversityPanel({ data }: DiversityPanelProps) {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DemographicBar buckets={data.gender_distribution} title="Gender Distribution" />
        <DemographicBar buckets={data.age_distribution}   title="Age Distribution" />
      </div>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-400" />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              Underrepresentation Warnings
            </p>
          </div>
          <div className="space-y-2">
            {data.warnings.map((w, i) => <FairnessFlag key={i} warning={w} />)}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="rounded-2xl p-5"
          style={{ background: "var(--bg-surface)", border: "1px solid rgba(14,165,233,0.15)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)" }}>
              <Lightbulb size={14} style={{ color: "var(--teal-400)" }} />
            </div>
            <p className="text-sm font-bold" style={{ color: "var(--teal-400)" }}>AI Recommendations</p>
          </div>
          <ul className="space-y-2.5">
            {data.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--teal-400)" }} />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
