"use client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import RiskTable from "@/components/risk/RiskTable";
import { MOCK_SCREEN_COHORT } from "@/lib/mockData";
import { TrendingUp } from "lucide-react";

export default function RiskPage() {
  const patients = MOCK_SCREEN_COHORT.results;
  const highCount = patients.filter((p) => p.risk_level === "HIGH").length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-5 py-8 space-y-6 animate-fadeIn">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <TrendingUp size={22} style={{ color: "var(--red-400)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Risk Overview</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {highCount} high-risk patients · sorted by descending dropout risk score
            </p>
          </div>
        </div>

        <div className="animate-slideInUp">
          <RiskTable patients={patients} />
        </div>
      </div>
    </DashboardLayout>
  );
}
