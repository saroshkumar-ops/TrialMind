"use client";
import { ScreeningDecision, RiskLevel } from "@/types/screening";

type Variant = "decision" | "risk" | "severity" | "audit" | "default";

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  value?: ScreeningDecision | RiskLevel | string;
  className?: string;
}

const DECISION_STYLES: Record<ScreeningDecision, string> = {
  ELIGIBLE:        "bg-green-500/15 text-green-400 border border-green-500/25",
  REQUIRES_REVIEW: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  INELIGIBLE:      "bg-red-500/15   text-red-400   border border-red-500/25",
};

const RISK_STYLES: Record<RiskLevel, string> = {
  LOW:    "bg-green-500/15 text-green-400 border border-green-500/25",
  MEDIUM: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  HIGH:   "bg-red-500/15   text-red-400   border border-red-500/25",
};

const AUDIT_STYLES: Record<string, string> = {
  ESCALATION:    "bg-red-500/15    text-red-400    border border-red-500/25",
  RISK:          "bg-amber-500/15  text-amber-400  border border-amber-500/25",
  SCREENING:     "bg-blue-500/15   text-blue-400   border border-blue-500/25",
  ADHERENCE:     "bg-purple-500/15 text-purple-400 border border-purple-500/25",
  FAIRNESS:      "bg-teal-500/15   text-teal-400   border border-teal-500/25",
  HITL_APPROVE:  "bg-green-500/15  text-green-400  border border-green-500/25",
  HITL_OVERRIDE: "bg-amber-500/15  text-amber-400  border border-amber-500/25",
  HITL_ESCALATE: "bg-red-500/15    text-red-400    border border-red-500/25",
};

export default function Badge({ children, variant = "default", value, className = "" }: BadgeProps) {
  let styles = "bg-white/5 text-slate-400 border border-white/10";

  if (variant === "decision" && value) {
    styles = DECISION_STYLES[value as ScreeningDecision] ?? styles;
  } else if (variant === "risk" && value) {
    styles = RISK_STYLES[value as RiskLevel] ?? styles;
  } else if (variant === "severity" && value) {
    styles = RISK_STYLES[value as RiskLevel] ?? styles;
  } else if (variant === "audit" && value) {
    styles = AUDIT_STYLES[value] ?? styles;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${styles} ${className}`}>
      {children}
    </span>
  );
}
