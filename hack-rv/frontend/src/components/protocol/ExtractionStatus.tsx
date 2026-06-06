"use client";
import { CheckCircle2, Loader2, Circle, AlertCircle } from "lucide-react";

type Step = "idle" | "uploading" | "extracting" | "done" | "error";

interface ExtractionStatusProps {
  step: Step;
  error?: string;
}

const STEPS: { key: Step | "done"; label: string; desc: string }[] = [
  { key: "uploading",  label: "Uploading PDF",      desc: "Sending file to AI pipeline"     },
  { key: "extracting", label: "Extracting criteria", desc: "LLM parsing inclusion/exclusion" },
  { key: "done",       label: "Criteria ready",      desc: "Protocol extracted successfully" },
];

function stepIndex(step: Step) {
  if (step === "uploading")  return 0;
  if (step === "extracting") return 1;
  if (step === "done")       return 2;
  return -1;
}

export default function ExtractionStatus({ step, error }: ExtractionStatusProps) {
  if (step === "idle") return null;
  const current = stepIndex(step);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {STEPS.map((s, i) => {
        const done   = i < current || step === "done";
        const active = i === current && step !== "done";

        return (
          <div key={s.key} style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            borderRadius: 10,
            border: `0.5px solid ${
              done   ? "#B4DACC" :
              active ? "#BAD0F5" :
              "#EDF0F4"
            }`,
            background:
              done   ? "#EAF5F0" :
              active ? "#EEF4FE" :
              "#F7F8FA",
            transition: "all 200ms ease",
          }}>
            {/* Icon */}
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background:
                done   ? "#FFFFFF" :
                active ? "#FFFFFF" :
                "#F0F4F8",
              border: `0.5px solid ${
                done   ? "#B4DACC" :
                active ? "#BAD0F5" :
                "#E4E8EE"
              }`,
            }}>
              {done
                ? <CheckCircle2 size={14} style={{ color: "#2D8A65" }} />
                : active
                ? <Loader2 size={14} style={{ color: "#2B6BC4" }} className="animate-spin" />
                : <Circle size={14} style={{ color: "#9BA8B5" }} />
              }
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 13, fontWeight: 500, margin: 0,
                color:
                  done   ? "#0A6644" :
                  active ? "#1A458A" :
                  "#9BA8B5",
              }}>
                {s.label}
              </p>
              <p style={{ fontSize: 11, color: "#6B7A8D", marginTop: 1 }}>
                {s.desc}
              </p>
            </div>

            {/* Active pulse dots */}
            {active && (
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {[0, 1, 2].map(j => (
                  <div key={j} style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: "#3D7ED8",
                    animation: "pulse-dot 1.2s ease-in-out infinite",
                    animationDelay: `${j * 200}ms`,
                  }} />
                ))}
              </div>
            )}

            {/* Done checkmark label */}
            {done && (
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: "#0A6644",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                flexShrink: 0,
              }}>
                Done
              </span>
            )}
          </div>
        );
      })}

      {/* Error state */}
      {error && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "10px 14px", borderRadius: 10,
          background: "#FEF2F2",
          border: "0.5px solid #F5C0C0",
        }}>
          <AlertCircle size={14} style={{ color: "#B83434", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#8B1F1F", lineHeight: 1.5 }}>{error}</p>
        </div>
      )}
    </div>
  );
}