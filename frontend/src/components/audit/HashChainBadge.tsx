"use client";
import { Lock, ShieldAlert, ShieldCheck } from "lucide-react";

interface HashChainBadgeProps {
  chainValid: boolean;
}

export default function HashChainBadge({ chainValid }: HashChainBadgeProps) {
  if (chainValid) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold"
        style={{
          background: "rgba(34,197,94,0.10)",
          border: "1px solid rgba(34,197,94,0.2)",
          color: "#4ADE80",
          boxShadow: "0 0 12px rgba(34,197,94,0.08)",
        }}>
        <Lock size={12} />
        Tamper-evident chain valid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold animate-pulse"
      style={{
        background: "rgba(239,68,68,0.12)",
        border: "1px solid rgba(239,68,68,0.3)",
        color: "#F87171",
        boxShadow: "0 0 16px rgba(239,68,68,0.15)",
      }}>
      <ShieldAlert size={12} />
      Chain integrity FAILED
    </span>
  );
}
