"use client";
import { ScreenCohortResponse, ScreenedPatient, ScreeningDecision, RiskLevel } from "@/types/screening";
import { useState, useMemo } from "react";
import PatientRow from "./PatientRow";
import ScreeningFilters from "./ScreeningFilters";
import Badge from "@/components/ui/Badge";
import { ChevronUp, ChevronDown, CheckCircle2, Flag, XCircle } from "lucide-react";

interface Filters {
  query: string;
  decision: ScreeningDecision | "ALL";
  risk: RiskLevel | "ALL";
}

interface ScreeningTableProps {
  data: ScreenCohortResponse;
  selectedId: string | null;
  onSelect: (p: ScreenedPatient) => void;
}

type SortKey = "name" | "decision" | "confidence" | "risk_score";
type SortDir = "asc" | "desc";

const DECISION_ORDER: Record<ScreeningDecision, number> = {
  ELIGIBLE: 0, REQUIRES_REVIEW: 1, INELIGIBLE: 2,
};

export default function ScreeningTable({ data, selectedId, onSelect }: ScreeningTableProps) {
  const [filters, setFilters] = useState<Filters>({ query: "", decision: "ALL", risk: "ALL" });
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "decision", dir: "asc" });

  const filtered = useMemo(() => {
    let res = data.results;
    if (filters.query)
      res = res.filter((p) => p.name.toLowerCase().includes(filters.query.toLowerCase()) || p.patient_id.includes(filters.query));
    if (filters.decision !== "ALL") res = res.filter((p) => p.decision === filters.decision);
    if (filters.risk !== "ALL")     res = res.filter((p) => p.risk_level === filters.risk);
    res = [...res].sort((a, b) => {
      let cmp = 0;
      if (sort.key === "name")       cmp = a.name.localeCompare(b.name);
      if (sort.key === "decision")   cmp = DECISION_ORDER[a.decision] - DECISION_ORDER[b.decision];
      if (sort.key === "confidence") cmp = (b.confidence ?? 0) - (a.confidence ?? 0);
      if (sort.key === "risk_score") cmp = (b.risk_score ?? 0) - (a.risk_score ?? 0);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return res;
  }, [data.results, filters, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));

  const Th = ({ label, sortKey }: { label: string; sortKey?: SortKey }) => (
    <th
      className={`px-5 py-4 text-left select-none transition-colors ${
        sortKey ? "cursor-pointer" : ""
      }`}
      style={{
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
      }}
      onClick={() => sortKey && toggleSort(sortKey)}
    >
      <span className="flex items-center gap-1.5">
        {label}

        {sortKey && sort.key === sortKey && (
          <span
            style={{
              color: "#1D9E75",
            }}
          >
            {sort.dir === "asc" ? (
              <ChevronUp size={12} />
            ) : (
              <ChevronDown size={12} />
            )}
          </span>
        )}
      </span>
    </th>
  );

  return (
    <div className="flex flex-col overflow-hidden h-full">
      {/* Cohort Summary */}
      <div
        className="flex items-center gap-4 px-5 py-4 flex-wrap flex-shrink-0"
        style={{
          background: "var(--bg-surface)",
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Cohort Summary
          </p>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-2 rounded-full"
          style={{
            background: "rgba(29,158,117,0.08)",
            border: "0.5px solid rgba(29,158,117,0.18)",
          }}
        >
          <CheckCircle2 size={12} style={{ color: "#1D9E75" }} />
          <span className="text-sm font-medium" style={{ color: "#1D9E75" }}>
            {data.summary.ELIGIBLE}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Eligible
          </span>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-2 rounded-full"
          style={{
            background: "rgba(186,117,23,0.08)",
            border: "0.5px solid rgba(186,117,23,0.18)",
          }}
        >
          <Flag size={12} style={{ color: "#BA7517" }} />
          <span className="text-sm font-medium" style={{ color: "#BA7517" }}>
            {data.summary.REQUIRES_REVIEW}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Review
          </span>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-2 rounded-full"
          style={{
            background: "rgba(226,75,74,0.08)",
            border: "0.5px solid rgba(226,75,74,0.18)",
          }}
        >
          <XCircle size={12} style={{ color: "#E24B4A" }} />
          <span className="text-sm font-medium" style={{ color: "#E24B4A" }}>
            {data.summary.INELIGIBLE}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Ineligible
          </span>
        </div>

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
              fontSize: 14,
              color: "var(--text-primary)",
            }}
          >
            {data.total} Patients
          </p>
        </div>
      </div>

      <ScreeningFilters
        filters={filters}
        onChange={setFilters}
        totalShown={filtered.length}
        totalAll={data.total}
      />

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead
            className="sticky top-0 z-10"
            style={{
              background: "var(--bg-surface)",
              borderBottom: "0.5px solid var(--border)",
            }}
          >
            <tr>
              <Th label="Patient" sortKey="name" />
              <Th label="Decision" sortKey="decision" />
              <Th label="Confidence" sortKey="confidence" />
              <Th label="Risk" sortKey="risk_score" />
              <th className="w-10" />
            </tr>
          </thead>

          <tbody
            className="divide-y"
            style={{
              borderColor: "var(--border)",
            }}
          >
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-20 text-center"
                >
                  <div>
                    <p
                      style={{
                        fontSize: 14,
                        color: "var(--text-primary)",
                        marginBottom: 4,
                      }}
                    >
                      No matching patients found
                    </p>

                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                      }}
                    >
                      Adjust the current search or filter criteria.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => (
                <PatientRow
                  key={p.patient_id}
                  patient={p}
                  selected={selectedId === p.patient_id}
                  onClick={() => onSelect(p)}
                  index={i}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
