"use client";
import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AuditLog from "@/components/audit/AuditLog";
import HashChainBadge from "@/components/audit/HashChainBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { AuditTrailResponse } from "@/types/audit";
import { MOCK_AUDIT } from "@/lib/mockData";
import { RefreshCw, ClipboardList, Shield } from "lucide-react";

const USE_MOCK = false;
const POLL_MS = 30_000;

export default function AuditPage() {
  const [data, setData] = useState<AuditTrailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        setData(MOCK_AUDIT);
      } else {
        const AIML_URL = process.env.NEXT_PUBLIC_AIML_URL ?? "http://localhost:8000";
        const res = await fetch(`${AIML_URL}/audit-trail`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const entries = (raw.entries ?? []).map((e: Record<string, unknown>) => ({
          id: e.id as string,
          timestamp: e.timestamp as string,
          type: (e.action as string ?? "SCREENING").replace("HITL_APPROVE", "HITL_APPROVE").replace("HITL_OVERRIDE", "HITL_OVERRIDE").replace("HITL_ESCALATE", "HITL_ESCALATE") as "SCREENING" | "RISK" | "ESCALATION" | "HITL_APPROVE" | "HITL_OVERRIDE" | "HITL_ESCALATE" | "ADHERENCE" | "FAIRNESS",
          agent: (e.actor as string) ?? "system",
          description: (e.action as string ?? "") + (e.patient_id ? ` — patient ${e.patient_id}` : ""),
          patient_id: e.patient_id as string | undefined,
          hash: e.hash as string | undefined,
        }));
        setData({ chain_valid: raw.chain_valid, entries });
      }
      setLastUpdated(new Date());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-5 py-8 space-y-6 animate-fadeIn">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)" }}>
              <Shield size={22} style={{ color: "var(--teal-400)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                Audit Trail
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Tamper-evident hash-chained log · Auto-refreshes every 30s
                {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {data && <HashChainBadge chainValid={data.chain_valid} />}
            <button onClick={load} disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 hover:bg-white/[0.05]"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} style={{ color: "var(--teal-400)" }} />
              Refresh
            </button>
          </div>
        </div>

        {data && (
          <div className="flex flex-wrap gap-2 pt-2">
            {[
              { label: "Total Entries", val: data.entries.length },
              { label: "Escalations", val: data.entries.filter(e => e.type === "ESCALATION").length },
              { label: "HITL Actions", val: data.entries.filter(e => e.type.startsWith("HITL")).length },
            ].map((stat) => (
              <span key={stat.label} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--teal-400)" }} />
                {stat.val} {stat.label}
              </span>
            ))}
          </div>
        )}

        {loading && !data ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner label="Loading audit trail…" />
          </div>
        ) : data && data.entries.length > 0 ? (
          <div className="animate-slideInUp">
            <AuditLog data={data} />
          </div>
        ) : (
          <div className="rounded-2xl p-16 text-center"
            style={{ border: "2px dashed rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.01)" }}>
            <ClipboardList size={32} className="mx-auto mb-4" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              No audit entries yet.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
