"use client";
import Badge from "@/components/ui/Badge";
import { EnrollPatientResponse } from "@/types/patient";
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, Clock } from "lucide-react";

interface EnrollResultProps {
  result: EnrollPatientResponse;
  onViewConsent: () => void;
}

export default function EnrollResult({ result, onViewConsent }: EnrollResultProps) {
  const eligible   = result.screening_decision === "ELIGIBLE";
  const review     = result.screening_decision === "REQUIRES_REVIEW";
  const ineligible = result.screening_decision === "INELIGIBLE";

  const decisionConfig = eligible
    ? {
        bg: "#EAF5F0", border: "#B4DACC",
        iconBg: "#FFFFFF", iconBorder: "#B4DACC",
        icon: <CheckCircle2 size={20} style={{ color: "#2D8A65" }} />,
        textColor: "#0A6644",
      }
    : review
    ? {
        bg: "#FFF8EC", border: "#F5D9A0",
        iconBg: "#FFFFFF", iconBorder: "#F5D9A0",
        icon: <AlertTriangle size={20} style={{ color: "#A06A14" }} />,
        textColor: "#7A4E0A",
      }
    : {
        bg: "#FEF2F2", border: "#F5C0C0",
        iconBg: "#FFFFFF", iconBorder: "#F5C0C0",
        icon: <XCircle size={20} style={{ color: "#B83434" }} />,
        textColor: "#8B1F1F",
      };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Decision header */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 14,
        padding: "16px 18px",
        borderRadius: 12,
        background: decisionConfig.bg,
        border: `0.5px solid ${decisionConfig.border}`,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: decisionConfig.iconBg,
          border: `0.5px solid ${decisionConfig.iconBorder}`,
        }}>
          {decisionConfig.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <Badge variant="decision" value={result.screening_decision}>
              {result.screening_decision.replace("_", " ")}
            </Badge>
            <span style={{
              fontSize: 11, fontWeight: 500,
              color: decisionConfig.textColor,
              background: decisionConfig.iconBg,
              border: `0.5px solid ${decisionConfig.border}`,
              borderRadius: 999,
              padding: "2px 9px",
            }}>
              {Math.round(result.screening_confidence * 100)}% confidence
            </span>
          </div>
          <p style={{ fontSize: 13, color: decisionConfig.textColor, lineHeight: 1.6, margin: 0 }}>
            {result.message}
          </p>
        </div>
      </div>

      {/* Screening evidence */}
      {result.screening_evidence && result.screening_evidence.length > 0 && (
        <div style={{
          background: "#FFFFFF",
          border: "0.5px solid #E4E8EE",
          borderRadius: 12,
          padding: "14px 16px",
          boxShadow: "0 1px 4px rgba(28,43,58,0.05)",
        }}>
          <p style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.09em",
            textTransform: "uppercase", color: "#9BA8B5", marginBottom: 10,
          }}>
            Screening evidence
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
            {result.screening_evidence.map((ev, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                <ArrowRight size={11} style={{ color: "#6B7A8D", flexShrink: 0, marginTop: 3 }} />
                <span style={{ fontSize: 13, color: "#3D4F60", lineHeight: 1.55 }}>{ev}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Patient ID */}
      <p style={{ fontSize: 11, color: "#9BA8B5", textAlign: "center", margin: 0 }}>
        Patient ID:{" "}
        <span style={{ fontFamily: "monospace", color: "#6B7A8D" }}>{result.patient_id}</span>
      </p>

      {/* CTA — Eligible */}
      {eligible && result.consent_required && (
        <button
          onClick={onViewConsent}
          style={{
            width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px 0",
            borderRadius: 10,
            fontSize: 13, fontWeight: 500,
            border: "none",
            background: "#2B6BC4",
            color: "#FFFFFF",
            cursor: "pointer",
            transition: "background 160ms ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1F57A8")}
          onMouseLeave={e => (e.currentTarget.style.background = "#2B6BC4")}
        >
          Review &amp; sign eConsent
          <ArrowRight size={14} />
        </button>
      )}

      {/* Review notice */}
      {review && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "12px 14px", borderRadius: 10,
          background: "#FFF8EC",
          border: "0.5px solid #F5D9A0",
        }}>
          <Clock size={14} style={{ color: "#A06A14", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#7A4E0A", lineHeight: 1.6, margin: 0 }}>
            Your case will be reviewed by a clinician. You will be contacted within 3 business days.
          </p>
        </div>
      )}

    </div>
  );
}