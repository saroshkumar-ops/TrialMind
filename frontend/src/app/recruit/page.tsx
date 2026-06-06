"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import EnrollmentForm, { EnrollFormValues } from "@/components/recruit/EnrollmentForm";
import EnrollResult from "@/components/recruit/EnrollResult";
import ConsentCard from "@/components/recruit/ConsentCard";
import { EnrollPatientResponse } from "@/types/patient";
import { Trial } from "@/types/trial";
import { MOCK_PROTOCOL } from "@/lib/mockData";
import { UserPlus, Users, FlaskConical, Check, ChevronRight } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { MOCK_PATIENT_LIST } from "@/lib/mockData";

const AIML_URL = process.env.NEXT_PUBLIC_AIML_URL ?? "http://localhost:8000";
type Step = "form" | "result" | "consent";

export default function RecruitPage() {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [trialId, setTrialId] = useState<string>("");
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnrollPatientResponse | null>(null);
  const [patientName, setPatientName] = useState("");
  const [consentSigned, setConsentSigned] = useState(false);
  const [showRegistry, setShowRegistry] = useState(false);
  const [registryPatients, setRegistryPatients] = useState(MOCK_PATIENT_LIST.patients);
  const [registryLoaded, setRegistryLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${AIML_URL}/trials`);
        const data: Trial[] = await res.json();
        setTrials(data);
        if (data.length) setTrialId((cur) => cur || data[0].trial_id);
      } catch (e) { console.error("Failed to load trials", e); }
    })();
  }, []);

  const selectedTrial = trials.find((t) => t.trial_id === trialId);
  const handleReset = () => { setStep("form"); setResult(null); setConsentSigned(false); };

  const handleEnroll = async (data: EnrollFormValues) => {
    setPatientName(String(data.name ?? "Patient"));
    setLoading(true);
    try {
      const res = await fetch(`${AIML_URL}/patients`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, trial_id: trialId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const decision = raw.auto_screen?.decision || "REQUIRES_REVIEW";
      setResult({
        patient_id: raw.patient.patient_id,
        name: raw.patient.name,
        screening_decision: decision,
        screening_confidence: raw.auto_screen?.confidence || 0,
        screening_evidence: raw.auto_screen?.evidence || [],
        consent_required: decision === "ELIGIBLE",
        message: decision === "ELIGIBLE"
          ? "Patient is eligible. eConsent required before enrolment."
          : "Patient does not meet eligibility criteria for this trial.",
      });
      setRegistryLoaded(false);
      setStep("result");
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadRegistry = async () => {
    try {
      const res = await fetch(`${AIML_URL}/patients?source=self-enroll`);
      const json = await res.json();
      setRegistryPatients(json.patients ?? []);
    } catch { /* ignore */ }
    setRegistryLoaded(true);
  };

  const STEPS = ["Fill Form", "Screen Result", "eConsent"];

  return (
    <DashboardLayout>
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "36px 28px",
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 32,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              Trial Enrollment
            </p>

            <h1
              style={{
                fontSize: 32,
                fontWeight: 400,
                lineHeight: 1.2,
                color: "var(--text-primary)",
                fontFamily: "'Lora', Georgia, serif",
              }}
            >
              Patient Enrollment
            </h1>

            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                marginTop: 6,
              }}
            >
              Protocol-aware enrollment with instant AI screening.
            </p>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12,
              fontWeight: 500,
              padding: "7px 14px",
              borderRadius: 999,
              border: "0.5px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#22c55e",
              }}
            />
            Phase 1
          </div>
        </div>

        {/* Trial selector */}
        <div
          style={{
            borderRadius: 12,
            padding: 20,
            background: "var(--bg-surface)",
            border: "0.5px solid var(--border)",
            marginBottom: 20,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 12,
            }}
          >
            Enrolling For Trial
          </p>
          <select
            value={trialId}
            onChange={(e) => { setTrialId(e.target.value); handleReset(); }}
            className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none transition-all mb-3"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            {trials.length === 0 && <option value="">Loading trials…</option>}
            {trials.map((t) => <option key={t.trial_id} value={t.trial_id}>{t.name}</option>)}
          </select>

          {selectedTrial && (
            <div className="flex flex-wrap gap-2">
              {selectedTrial.inclusion.map((c) => (
                <span key={c} className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ADE80" }}>
                  <Check size={10} /> {c}
                </span>
              ))}
              {selectedTrial.exclusion.map((c) => (
                <span key={c} className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}>
                  <span className="text-[12px] leading-none mb-0.5">✗</span> {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Step indicator */}
        <div
  style={{
    marginBottom: 24,
    padding: "14px 18px",
    borderRadius: 12,
    background: "var(--bg-surface)",
    border: "0.5px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: 12,
  }}
>
  {STEPS.map((s, i) => {
    const idx = ["form", "result", "consent"].indexOf(step);

    const done = i < idx;
    const active = i === idx;

    return (
      <div key={s} className="flex items-center gap-2">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 999,
            border: active
              ? "1px solid rgba(29,158,117,0.25)"
              : "0.5px solid var(--border)",
            background: active
              ? "rgba(29,158,117,0.08)"
              : "var(--bg-elevated)",
          }}
        >
          {/* step circle */}
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 600,
              background:
                done || active ? "#1D9E75" : "transparent",
              color:
                done || active ? "#fff" : "var(--text-muted)",
              border:
                done || active
                  ? "none"
                  : "1px solid var(--border)",
            }}
          >
            {done ? "✓" : i + 1}
          </span>

          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: active
                ? "#1D9E75"
                : "var(--text-secondary)",
            }}
          >
            {s}
          </span>
        </div>

        {i < STEPS.length - 1 && (
          <ChevronRight
            size={12}
            style={{ color: "var(--text-muted)" }}
          />
        )}
      </div>
    );
  })}
</div>

        {/* Content */}
        {step === "form" && selectedTrial && (
          <EnrollmentForm key={selectedTrial.trial_id} fields={selectedTrial.enroll_fields} trialName={selectedTrial.name} onSubmit={handleEnroll} loading={loading} />
        )}

        {step === "result" && result && (
          <div className="space-y-4 animate-slideInUp">
            <EnrollResult result={result} onViewConsent={() => setStep("consent")} />
            <button onClick={handleReset} className="w-full py-2 text-sm transition-colors hover:opacity-80" style={{ color: "var(--text-muted)" }}>
              ← Enroll another patient
            </button>
          </div>
        )}

        {step === "consent" && result && (
          <div className="space-y-4 animate-slideInUp">
            <ConsentCard protocol={MOCK_PROTOCOL} patientName={patientName} onSign={() => setConsentSigned(true)} signed={consentSigned} />
            {consentSigned && (
              <button onClick={handleReset} className="w-full py-2 text-sm transition-colors hover:opacity-80" style={{ color: "var(--text-muted)" }}>
                ← Enroll another patient
              </button>
            )}
          </div>
        )}

        {/* Registry */}
        <div className="pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => { setShowRegistry((v) => !v); if (!registryLoaded) loadRegistry(); }}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl transition-all"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            <Users size={14} style={{ color: "var(--teal-400)" }} />
            {showRegistry ? "Hide" : "Show"} recent self-enrollments
          </button>

          {showRegistry && (
            <div className="mt-4 rounded-2xl overflow-hidden animate-fadeIn"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" }}>
                  <tr>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Patient</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border-muted)" }}>
                  {registryPatients.map((p) => (
                    <tr key={p.patient_id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Age {p.age} · {p.gender}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        {p.screening_decision && (
                          <Badge variant="decision" value={p.screening_decision}>
                            {p.screening_decision.replace("_", " ")}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
