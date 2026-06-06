"use client";
// ReviewCard — shown inline after HITLBanner recorded confirmation
import { CheckCircle } from "lucide-react";

interface ReviewCardProps {
  auditId: string;
  action: string;
}

export default function ReviewCard({ auditId, action }: ReviewCardProps) {
  return (
    <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
      <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
      <div>
        <p className="text-sm font-semibold text-green-300">Recorded ✓ · Action: {action}</p>
        <p className="text-xs text-green-400/70 mt-0.5">Ref: {auditId}</p>
      </div>
    </div>
  );
}
