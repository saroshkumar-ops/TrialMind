"use client";
import { ScreenedPatient } from "@/types/screening";
import Badge from "@/components/ui/Badge";
import ScoreBar from "@/components/ui/ScoreBar";
import { ChevronRight } from "lucide-react";

interface PatientRowProps {
  patient: ScreenedPatient;
  selected: boolean;
  onClick: () => void;
  index: number;
}

export default function PatientRow({ patient, selected, onClick, index }: PatientRowProps) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer group transition-colors animate-fadeIn"
      style={{
        animationDelay: `${index * 25}ms`,
        background: selected ? "rgba(29,158,117,0.06)" : "transparent",
        borderLeft: selected
          ? "2px solid #1D9E75"
          : "2px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.background =
            "rgba(29,158,117,0.03)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }
      }}
    >
      {/* Name */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
            style={
              selected
                ? {
                    background: "rgba(29,158,117,0.08)",
                    color: "#1D9E75",
                    border: "0.5px solid rgba(29,158,117,0.18)",
                  }
                : {
                    background: "var(--bg-surface)",
                    color: "var(--text-secondary)",
                    border: "0.5px solid var(--border)",
                  }
            }
          >
            {patient.name.charAt(0)}
          </div>

          <div>
            <p
              className="text-sm font-medium"
              style={{
                color: "var(--text-primary)",
              }}
            >
              {patient.name}
            </p>

            <p
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                letterSpacing: "0.02em",
              }}
            >
              {patient.patient_id}
            </p>
          </div>
        </div>
      </td>

      {/* Decision */}
      <td className="px-5 py-4">
        <Badge variant="decision" value={patient.decision}>
          {patient.decision.replace("_", " ")}
        </Badge>
      </td>

      {/* Confidence */}
      <td className="px-5 py-4 w-40">
        <ScoreBar
          value={patient.confidence}
          colorScheme="confidence"
          height={3}
        />
      </td>

      {/* Risk */}
      <td className="px-5 py-4">
        {patient.risk_unavailable ? (
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            Pending
          </span>
        ) : (
          <Badge variant="risk" value={patient.risk_level}>
            {patient.risk_level}
            {patient.risk_score !== undefined && (
              <span className="ml-1 opacity-60">
                ({Math.round(patient.risk_score * 100)}%)
              </span>
            )}
          </Badge>
        )}
      </td>

      {/* Arrow */}
      <td className="px-4 py-4 w-10 text-right">
        <ChevronRight
          size={14}
          style={{
            color: selected ? "#1D9E75" : "var(--text-muted)",
          }}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </td>
    </tr>
  );
}
