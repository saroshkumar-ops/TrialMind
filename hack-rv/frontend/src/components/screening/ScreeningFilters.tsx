"use client";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { ScreeningDecision, RiskLevel } from "@/types/screening";

interface Filters {
  query: string;
  decision: ScreeningDecision | "ALL";
  risk: RiskLevel | "ALL";
}

interface ScreeningFiltersProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  totalShown: number;
  totalAll: number;
}

const DECISIONS: (ScreeningDecision | "ALL")[] = ["ALL", "ELIGIBLE", "REQUIRES_REVIEW", "INELIGIBLE"];
const RISKS: (RiskLevel | "ALL")[] = ["ALL", "HIGH", "MEDIUM", "LOW"];
const DECISION_LABEL: Record<ScreeningDecision | "ALL", string> = {
  ALL: "All Decisions", ELIGIBLE: "Eligible", REQUIRES_REVIEW: "Review", INELIGIBLE: "Ineligible",
};
const RISK_LABEL: Record<RiskLevel | "ALL", string> = {
  ALL: "All Risk", HIGH: "High Risk", MEDIUM: "Medium", LOW: "Low",
};

const selectStyle: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  color: "var(--text-secondary)",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  outline: "none",
};

export default function ScreeningFilters({ filters, onChange, totalShown, totalAll }: ScreeningFiltersProps) {
  const set = (k: keyof Filters, v: string) => onChange({ ...filters, [k]: v });
  const active = filters.decision !== "ALL" || filters.risk !== "ALL" || filters.query;

  return (
    <div
      className="flex flex-wrap items-center gap-3 px-5 py-4 flex-shrink-0"
      style={{
        borderBottom: "0.5px solid var(--border)",
        background: "var(--bg-surface)",
      }}
    >
      {/* Search */}
      <div className="relative flex-1 min-w-[220px] max-w-[320px]">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }}
        />

        <input
          type="text"
          placeholder="Search patients"
          value={filters.query}
          onChange={(e) => set("query", e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg focus:outline-none"
          style={{
            background: "var(--bg-surface)",
            border: filters.query
              ? "0.5px solid rgba(29,158,117,0.25)"
              : "0.5px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />

        {filters.query && (
          <button
            onClick={() => set("query", "")}
            className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Decision Filter */}
      <select
        value={filters.decision}
        onChange={(e) => set("decision", e.target.value)}
        style={{
          ...selectStyle,
          border: "0.5px solid var(--border)",
          borderRadius: 8,
          background: "var(--bg-surface)",
          minWidth: 140,
        }}
      >
        {DECISIONS.map((d) => (
          <option key={d} value={d}>
            {DECISION_LABEL[d]}
          </option>
        ))}
      </select>

      {/* Risk Filter */}
      <select
        value={filters.risk}
        onChange={(e) => set("risk", e.target.value)}
        style={{
          ...selectStyle,
          border: "0.5px solid var(--border)",
          borderRadius: 8,
          background: "var(--bg-surface)",
          minWidth: 140,
        }}
      >
        {RISKS.map((r) => (
          <option key={r} value={r}>
            {RISK_LABEL[r]}
          </option>
        ))}
      </select>

      {/* Clear Filters */}
      {active && (
        <button
          onClick={() =>
            onChange({
              query: "",
              decision: "ALL",
              risk: "ALL",
            })
          }
          className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-colors"
          style={{
            background: "rgba(29,158,117,0.08)",
            border: "0.5px solid rgba(29,158,117,0.18)",
            color: "#1D9E75",
          }}
        >
          <SlidersHorizontal size={12} />
          Clear Filters
        </button>
      )}

      {/* Count */}
      <div className="ml-auto text-right">
        <p
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Registry
        </p>

        <p
          style={{
            fontSize: 13,
            color: "var(--text-primary)",
          }}
        >
          {totalShown} of {totalAll}
        </p>
      </div>
    </div>
  );
}
