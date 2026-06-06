"use client";
import { useState } from "react";
import { ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { ScreeningEvidence } from "@/types/screening";

interface EvidenceAccordionProps {
  evidence: ScreeningEvidence[];
  className?: string;
}

export default function EvidenceAccordion({ evidence, className = "" }: EvidenceAccordionProps) {
  const [open, setOpen] = useState(true);
  const metCount = evidence.filter(e => e.met).length;

  return (
    <div className={`rounded-2xl overflow-hidden ${className}`}
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <button
        className="w-full flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
        style={{ background: "rgba(255,255,255,0.02)" }}
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
            Eligibility Evidence
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.15)", color: "var(--teal-400)" }}>
            {metCount}/{evidence.length} met
          </span>
        </div>
        <ChevronDown size={13} style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }} />
      </button>

      {open && (
        <ul className="divide-y" style={{ borderColor: "var(--border-muted)" }}>
          {evidence.map((ev, i) => (
            <li key={i} className="flex items-start gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02]">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${ev.met ? "" : ""}`}
                style={ev.met
                  ? { background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }
                  : { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                {ev.met
                  ? <CheckCircle2 size={12} className="text-green-400" />
                  : <XCircle size={12} className="text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug" style={{ color: "var(--text-primary)" }}>{ev.criterion}</p>
                {ev.patient_value && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Patient: <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{ev.patient_value}</span>
                    {ev.source && <span> · {ev.source}</span>}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
