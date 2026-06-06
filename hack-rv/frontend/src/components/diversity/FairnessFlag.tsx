"use client";
import { AlertTriangle } from "lucide-react";

interface FairnessFlagProps {
  warning: string;
  className?: string;
}

export default function FairnessFlag({ warning, className = "" }: FairnessFlagProps) {
  return (
    <div className={`flex items-start gap-3 rounded-xl px-4 py-3 ${className}`}
      style={{
        background: "rgba(245,158,11,0.06)",
        border: "1px solid rgba(245,158,11,0.18)",
      }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <AlertTriangle size={13} className="text-amber-400" />
      </div>
      <p className="text-sm leading-snug" style={{ color: "var(--text-secondary)" }}>{warning}</p>
    </div>
  );
}
