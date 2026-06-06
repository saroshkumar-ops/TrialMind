"use client";
import { ScreenedPatient } from "@/types/screening";
import Badge from "@/components/ui/Badge";
import ScoreBar from "@/components/ui/ScoreBar";

interface RiskTableProps {
  patients: ScreenedPatient[];
  onSelect?: (p: ScreenedPatient) => void;
}

export default function RiskTable({ patients, onSelect }: RiskTableProps) {
  const sorted = [...patients].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0));

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <table className="w-full text-left">
        <thead style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
          <tr>
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Patient</th>
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Risk Level</th>
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest w-40" style={{ color: "var(--text-muted)" }}>Risk Score</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "var(--border-muted)" }}>
          {sorted.map((p) => (
            <tr
              key={p.patient_id}
              onClick={() => onSelect?.(p)}
              className={`transition-colors ${onSelect ? "cursor-pointer hover:bg-white/[0.02]" : ""}`}
            >
              <td className="px-5 py-3.5">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>{p.patient_id}</p>
              </td>
              <td className="px-5 py-3.5">
                <Badge variant="risk" value={p.risk_level}>{p.risk_level}</Badge>
              </td>
              <td className="px-5 py-3.5 w-40">
                {p.risk_unavailable ? (
                  <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>model pending</span>
                ) : (
                  <ScoreBar value={p.risk_score ?? 0} colorScheme="risk" height={5} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
