"use client";
import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AdherenceTable from "@/components/adherence/AdherenceTable";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { AdherenceResponse } from "@/types/adherence";
import { MOCK_ADHERENCE } from "@/lib/mockData";
import { RefreshCw, Activity, HeartPulse } from "lucide-react";

const USE_MOCK = false;
const POLL_MS = 30_000;

export default function AdherencePage() {
  const [data, setData] = useState<AdherenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 500));
        setData(MOCK_ADHERENCE);
      } else {
        const AIML_URL = process.env.NEXT_PUBLIC_AIML_URL ?? "http://localhost:8000";
        const res = await fetch(`${AIML_URL}/adherence-overlay`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const deviations = (raw.patients ?? []).flatMap((p: Record<string, unknown>) =>
          ((p.alerts as Array<{severity: string; message: string}>) ?? []).map((a, i: number) => ({
            id: `${p.patient_id}-${i}`,
            patient_id: p.patient_id as string,
            patient_name: (p.first_name as string ?? "") + " " + (p.last_name as string ?? ""),
            type: a.severity === "HIGH" ? "Missed visit" : "Protocol deviation",
            description: a.message,
            severity: (a.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"),
            flagged_at: new Date().toISOString(),
          }))
        );
        setData({ deviations });
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
      <div className="max-w-4xl mx-auto px-5 py-8 space-y-8 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <HeartPulse size={22} style={{ color: "var(--amber-400)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Adherence Monitor</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Protocol deviation alerts · Auto-refreshes every 30s
                {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 hover:bg-white/[0.05]"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} style={{ color: "var(--amber-400)" }} />
            Refresh
          </button>
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner label="Loading adherence data…" />
          </div>
        ) : data && data.deviations.length > 0 ? (
          <AdherenceTable data={data} />
        ) : (
          <div className="rounded-2xl p-16 text-center"
            style={{ border: "2px dashed rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.01)" }}>
            <Activity size={32} className="mx-auto mb-4" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              No adherence deviations found. All patients are on track.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
