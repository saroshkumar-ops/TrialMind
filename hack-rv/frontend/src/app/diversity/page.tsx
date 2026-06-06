"use client";
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DiversityPanel from "@/components/diversity/DiversityPanel";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { FairnessAuditResponse } from "@/types/diversity";
import { MOCK_FAIRNESS } from "@/lib/mockData";
import { RefreshCw, Users } from "lucide-react";

const USE_MOCK = false;

export default function DiversityPage() {
  const [data, setData] = useState<FairnessAuditResponse | null>(USE_MOCK ? MOCK_FAIRNESS : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true); setError(null);
    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 800));
        setData(MOCK_FAIRNESS);
      } else {
        const AIML_URL = process.env.NEXT_PUBLIC_AIML_URL ?? "http://localhost:8000";
        const pRes = await fetch(`${AIML_URL}/patients`);
        const pJson = await pRes.json();
        const patients = (pJson.patients ?? []).map((p: Record<string, unknown>) => ({ age: p.age, gender: p.gender }));
        const res = await fetch(`${AIML_URL}/fairness-audit`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patients }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const toArr = (obj: Record<string, {count: number; percentage: number}>) =>
          Object.entries(obj ?? {}).map(([label, v]) => ({ label, count: v.count, percentage: v.percentage }));
        setData({
          gender_distribution: toArr(raw.gender_distribution ?? {}),
          age_distribution: toArr(raw.age_distribution ?? {}),
          warnings: raw.warnings ?? [],
          recommendations: raw.recommendations ?? [],
        });
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load fairness data"); }
    finally { setLoading(false); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-5 py-8 space-y-8 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}>
              <Users size={22} style={{ color: "var(--purple-400)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Diversity & Fairness Audit</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Demographic distribution and underrepresentation analysis
              </p>
            </div>
          </div>
          <button onClick={refresh} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 hover:bg-white/[0.05]"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} style={{ color: "var(--purple-400)" }} />
            Refresh Audit
          </button>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner label="Loading fairness data…" />
          </div>
        ) : data ? (
          <DiversityPanel data={data} />
        ) : (
          <div className="rounded-2xl p-16 text-center"
            style={{ border: "2px dashed rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.01)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              No data yet. Click <span className="font-bold" style={{ color: "var(--purple-400)" }}>Refresh Audit</span> to begin.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
