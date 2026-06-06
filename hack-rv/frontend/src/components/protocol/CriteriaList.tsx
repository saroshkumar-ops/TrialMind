"use client";
import { ProtocolExtractResult } from "@/types/trial";
import { CheckCircle2, XCircle } from "lucide-react";

interface CriteriaListProps {
  data: ProtocolExtractResult;
}

export default function CriteriaList({ data }: CriteriaListProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>

      {/* Inclusion */}
      <div style={{
        background: "#FFFFFF",
        border: "0.5px solid #E4E8EE",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(28,43,58,0.06)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px",
          background: "#EAF5F0",
          borderBottom: "0.5px solid #B4DACC",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#2D8A65", flexShrink: 0,
          }} />
          <p style={{ fontSize: 13, fontWeight: 500, color: "#0A6644", flex: 1 }}>
            Inclusion criteria
          </p>
          <span style={{
            fontSize: 11, fontWeight: 600,
            padding: "2px 8px", borderRadius: 999,
            background: "#FFFFFF",
            color: "#0A6644",
            border: "0.5px solid #B4DACC",
          }}>
            {data.inclusion_criteria.length}
          </span>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {data.inclusion_criteria.map((c, i) => (
            <li key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "10px 16px",
              borderBottom: i < data.inclusion_criteria.length - 1 ? "0.5px solid #EDF0F4" : "none",
            }}>
              <CheckCircle2
                size={13}
                style={{ color: "#2D8A65", flexShrink: 0, marginTop: 2 }}
              />
              <span style={{ fontSize: 13, color: "#3D4F60", lineHeight: 1.55 }}>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Exclusion */}
      <div style={{
        background: "#FFFFFF",
        border: "0.5px solid #E4E8EE",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(28,43,58,0.06)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px",
          background: "#FEF2F2",
          borderBottom: "0.5px solid #F5C0C0",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#B83434", flexShrink: 0,
          }} />
          <p style={{ fontSize: 13, fontWeight: 500, color: "#8B1F1F", flex: 1 }}>
            Exclusion criteria
          </p>
          <span style={{
            fontSize: 11, fontWeight: 600,
            padding: "2px 8px", borderRadius: 999,
            background: "#FFFFFF",
            color: "#8B1F1F",
            border: "0.5px solid #F5C0C0",
          }}>
            {data.exclusion_criteria.length}
          </span>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {data.exclusion_criteria.map((c, i) => (
            <li key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "10px 16px",
              borderBottom: i < data.exclusion_criteria.length - 1 ? "0.5px solid #EDF0F4" : "none",
            }}>
              <XCircle
                size={13}
                style={{ color: "#B83434", flexShrink: 0, marginTop: 2 }}
              />
              <span style={{ fontSize: 13, color: "#3D4F60", lineHeight: 1.55 }}>{c}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}