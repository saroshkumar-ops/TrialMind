"use client";
import { useState } from "react";
import { ProtocolExtractResult } from "@/types/trial";
import { FileCheck, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";

interface ConsentCardProps {
  protocol: ProtocolExtractResult;
  patientName: string;
  onSign: () => void;
  signed?: boolean;
}

export default function ConsentCard({ protocol, patientName, onSign, signed }: ConsentCardProps) {
  const [checked, setChecked] = useState(false);

  /* ── Signed state ── */
  if (signed) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 18px", borderRadius: 12,
        background: "#EAF5F0",
        border: "0.5px solid #B4DACC",
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#FFFFFF", border: "0.5px solid #B4DACC",
        }}>
          <FileCheck size={18} style={{ color: "#2D8A65" }} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#0A6644", margin: 0 }}>
            eConsent signed
          </p>
          <p style={{ fontSize: 12, color: "#2D8A65", marginTop: 3 }}>
            {patientName} —{" "}
            {new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <CheckCircle2 size={16} style={{ color: "#2D8A65", marginLeft: "auto", flexShrink: 0 }} />
      </div>
    );
  }

  /* ── Unsigned state ── */
  return (
    <div style={{
      background: "#FFFFFF",
      border: "0.5px solid #E4E8EE",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(28,43,58,0.06)",
    }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 18px",
        background: "#EEF4FE",
        borderBottom: "0.5px solid #BAD0F5",
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#FFFFFF", border: "0.5px solid #BAD0F5",
        }}>
          <ShieldCheck size={14} style={{ color: "#2B6BC4" }} />
        </div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "#1A458A", margin: 0 }}>
          Informed consent — Trial #1
        </p>
      </div>

      <div style={{ padding: "18px 18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Trial summary */}
        <div>
          <p style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.09em",
            textTransform: "uppercase", color: "#9BA8B5", marginBottom: 8,
          }}>
            Trial summary
          </p>
          <p style={{ fontSize: 13, color: "#3D4F60", lineHeight: 1.65, margin: 0 }}>
            This is a randomised controlled trial studying the efficacy of a new GLP-1 receptor agonist
            for Type 2 diabetes. Participants will attend monthly clinic visits over 12 months. Your data —
            including biomarkers and visit records — will be used solely for this study and stored securely
            in compliance with DPDP 2023 and ICH E6 GCP guidelines.
          </p>
        </div>

        {/* Criteria + Rights */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>

          <div>
            <p style={{
              fontSize: 10, fontWeight: 600, letterSpacing: "0.09em",
              textTransform: "uppercase", color: "#0A6644", marginBottom: 8,
            }}>
              You qualify because
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {protocol.inclusion_criteria.slice(0, 4).map((c, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <CheckCircle2 size={12} style={{ color: "#2D8A65", flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 12, color: "#3D4F60", lineHeight: 1.5 }}>{c}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{
            background: "#F7F8FA",
            border: "0.5px solid #E4E8EE",
            borderRadius: 10,
            padding: "12px 14px",
          }}>
            <p style={{
              fontSize: 10, fontWeight: 600, letterSpacing: "0.09em",
              textTransform: "uppercase", color: "#9BA8B5", marginBottom: 8,
            }}>
              Rights &amp; withdrawal
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "You may withdraw at any time without penalty",
                "All data collected remains confidential",
                "Side effects will be reported per CDSCO norms",
              ].map((line, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <ArrowRight size={11} style={{ color: "#6B7A8D", flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 12, color: "#6B7A8D", lineHeight: 1.5 }}>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Checkbox + Sign */}
        <div style={{
          paddingTop: 16,
          borderTop: "0.5px solid #E4E8EE",
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          <label style={{
            display: "flex", alignItems: "flex-start", gap: 12,
            cursor: "pointer",
          }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              style={{
                marginTop: 2, width: 16, height: 16,
                accentColor: "#2B6BC4", flexShrink: 0, cursor: "pointer",
              }}
            />
            <span style={{ fontSize: 13, color: "#3D4F60", lineHeight: 1.6 }}>
              I,{" "}
              <strong style={{ color: "#1C2B3A", fontWeight: 500 }}>{patientName}</strong>,
              {" "}confirm that I have read and understood the above information and voluntarily
              consent to participate in this clinical trial.
            </span>
          </label>

          <button
            onClick={onSign}
            disabled={!checked}
            style={{
              width: "100%",
              padding: "11px 0",
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 500,
              border: "none",
              cursor: checked ? "pointer" : "not-allowed",
              background: checked ? "#2B6BC4" : "#F0F4F8",
              color: checked ? "#FFFFFF" : "#9BA8B5",
              transition: "all 160ms ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            Sign eConsent digitally
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}