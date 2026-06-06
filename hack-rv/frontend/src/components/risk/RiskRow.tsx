"use client";
// RiskRow — single row in the risk table
import { ScreenedPatient } from "@/types/screening";
import Badge from "@/components/ui/Badge";
import ScoreBar from "@/components/ui/ScoreBar";

interface RiskRowProps {
  patient: ScreenedPatient;
  onClick?: () => void;
}

export default function RiskRow({ patient, onClick }: RiskRowProps) {
  return (
    <tr onClick={onClick} className="hover:bg-[--bg-hover] transition-colors cursor-pointer border-b border-[--border-muted]">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-[--text-primary]">{patient.name}</p>
        <p className="text-xs text-[--text-muted]">{patient.patient_id}</p>
      </td>
      <td className="px-4 py-3">
        <Badge variant="risk" value={patient.risk_level}>{patient.risk_level}</Badge>
      </td>
      <td className="px-4 py-3 w-40">
        {patient.risk_unavailable
          ? <span className="text-xs text-[--text-muted] italic">model pending</span>
          : <ScoreBar value={patient.risk_score ?? 0} colorScheme="risk" height={5} />
        }
      </td>
    </tr>
  );
}
