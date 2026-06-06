"use client";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import HITLBanner from "@/components/hitl/HITLBanner";
import { MOCK_ORCHESTRATE } from "@/lib/mockData";
import { HITLAction } from "@/types/hitl";
import { useState } from "react";
import { UserCheck, ArrowRight } from "lucide-react";

export default function ReviewPage() {
  const [hitlLoading, setHitlLoading] = useState(false);
  const [hitlRecorded, setHitlRecorded] = useState(false);

  const USE_MOCK = true;
  const ACTOR = "dr.chen";

  const handleHITL = async (action: HITLAction, reason?: string) => {
    setHitlLoading(true);
    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 600));
      } else {
        const AIML_URL = process.env.NEXT_PUBLIC_AIML_URL ?? "http://localhost:8000";
        await fetch(`${AIML_URL}/hitl-review`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audit_id: MOCK_ORCHESTRATE.audit_id, action, actor: ACTOR, override_reason: reason }),
        });
      }
      setHitlRecorded(true);
    } finally { setHitlLoading(false); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8 animate-fadeIn">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)" }}>
            <UserCheck size={22} style={{ color: "var(--teal-400)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>HITL Review Queue</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Human-in-the-loop gate — clinician approves, overrides, or escalates AI decisions.
            </p>
          </div>
        </div>

        {MOCK_ORCHESTRATE.escalation.escalated && (
          <div className="animate-slideInUp">
            <HITLBanner
              escalation={MOCK_ORCHESTRATE.escalation}
              auditId={MOCK_ORCHESTRATE.audit_id}
              onSubmit={handleHITL}
              loading={hitlLoading}
              recorded={hitlRecorded}
            />
          </div>
        )}

        <div className="rounded-2xl p-6 text-center animate-slideInUp"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            HITL reviews are dynamically generated and injected into the patient drawer on the Screening page when an escalation is required.
          </p>
          <Link href="/screening"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-white/[0.05]"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            Go to Screening <ArrowRight size={14} style={{ color: "var(--teal-400)" }} />
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
