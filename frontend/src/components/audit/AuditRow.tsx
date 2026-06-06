"use client";
import { AuditEntry } from "@/types/audit";
import Badge from "@/components/ui/Badge";
import { User, Bot, Clock } from "lucide-react";

interface AuditRowProps {
  entry: AuditEntry;
  isLast?: boolean;
}

export default function AuditRow({ entry, isLast }: AuditRowProps) {
  const time = new Date(entry.timestamp).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const highlight = entry.type === "ESCALATION" || entry.type.startsWith("HITL");

  return (
    <div className={`flex items-start gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.02] relative
      ${highlight ? "border-l-2" : "border-l-2 border-l-transparent"}`}
      style={highlight ? { borderLeftColor: "rgba(239,68,68,0.5)" } : {}}>
      {/* Timeline dot */}
      <div className="flex flex-col items-center flex-shrink-0 pt-1">
        <div className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: highlight ? "var(--red-400)" : "var(--teal-400)", boxShadow: highlight ? "0 0 6px rgba(239,68,68,0.5)" : "0 0 6px rgba(14,165,233,0.5)" }} />
        {!isLast && <div className="w-px flex-1 min-h-[16px] mt-1" style={{ background: "var(--border-muted)" }} />}
      </div>

      {/* Badge */}
      <Badge variant="audit" value={entry.type} className="mt-0.5 flex-shrink-0">
        {entry.type.replace("HITL_", "")}
      </Badge>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
          {entry.description}
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-1.5">
          {entry.patient_name && (
            <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <User size={10} /> {entry.patient_name}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
            <Bot size={10} /> {entry.agent}
          </span>
        </div>
      </div>

      {/* Time + hash */}
      <div className="text-right flex-shrink-0">
        <p className="flex items-center gap-1 text-[10px] font-mono justify-end" style={{ color: "var(--text-muted)" }}>
          <Clock size={9} /> {time}
        </p>
        {entry.hash && (
          <p className="text-[9px] font-mono mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
            #{entry.hash.slice(0, 8)}
          </p>
        )}
      </div>
    </div>
  );
}
