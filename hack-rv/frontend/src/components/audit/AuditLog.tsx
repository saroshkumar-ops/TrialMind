"use client";
import { AuditTrailResponse } from "@/types/audit";
import AuditRow from "./AuditRow";

interface AuditLogProps {
  data: AuditTrailResponse;
}

export default function AuditLog({ data }: AuditLogProps) {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="divide-y" style={{ borderColor: "var(--border-muted)" }}>
        {data.entries.map((e, i) => (
          <AuditRow key={e.id} entry={e} isLast={i === data.entries.length - 1} />
        ))}
      </div>
      {data.entries.length === 0 && (
        <p className="py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          No audit entries yet.
        </p>
      )}
    </div>
  );
}
