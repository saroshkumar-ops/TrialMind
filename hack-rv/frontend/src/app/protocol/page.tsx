"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProtocolUploader from "@/components/protocol/ProtocolUploader";
import CriteriaList from "@/components/protocol/CriteriaList";
import ExtractionStatus from "@/components/protocol/ExtractionStatus";
import { ProtocolExtractResult, Trial, EnrollField } from "@/types/trial";
import { FlaskConical, ListChecks } from "lucide-react";

const AIML_URL = process.env.NEXT_PUBLIC_AIML_URL ?? "http://localhost:8000";
type Step = "idle" | "uploading" | "extracting" | "done" | "error";

export default function ProtocolPage() {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [trialId, setTrialId] = useState<string>("");
  const [step, setStep] = useState<Step>("idle");
  const [result, setResult] = useState<ProtocolExtractResult | null>(null);
  const [fields, setFields] = useState<EnrollField[]>([]);
  const [error, setError] = useState<string | undefined>();

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

  const handleUpload = async (file: File) => {
    if (!trialId) return;
    setStep("uploading"); setResult(null); setFields([]); setError(undefined);
    try {
      await new Promise((r) => setTimeout(r, 500));
      setStep("extracting");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${AIML_URL}/trials/${trialId}/protocol`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      setResult({ trial_id: trialId, inclusion_criteria: raw.inclusion || [], exclusion_criteria: raw.exclusion || [] });
      setFields(raw.enroll_fields || []);
      setTrials((ts) => ts.map((t) => (t.trial_id === trialId ? { ...t, ...raw } : t)));
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
      setStep("error");
    }
  };

  const clinicalFields = fields.filter((f) => f.group === "clinical");

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
            marginBottom: 32,
          }}
        >
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
            Trial Management
          </p>

          <h1
            style={{
              fontSize: 32,
              fontWeight: 400,
              lineHeight: 1.2,
              color: "var(--text-primary)",
              fontFamily: "'Lora', Georgia, serif",
              marginBottom: 8,
            }}
          >
            Protocol Upload
          </h1>

          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              maxWidth: 720,
            }}
          >
            Upload a clinical protocol PDF. AI extracts eligibility criteria
            and automatically updates the enrollment workflow.
          </p>
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
            Apply Protocol To Trial
          </p>
          <select
            value={trialId}
            onChange={(e) => { setTrialId(e.target.value); setStep("idle"); setResult(null); setFields([]); }}
            className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          >
            {trials.length === 0 && <option value="">Loading trials…</option>}
            {trials.map((t) => <option key={t.trial_id} value={t.trial_id}>{t.name}</option>)}
          </select>
        </div>

        {/* Uploader */}
        <ProtocolUploader onUpload={handleUpload} loading={step === "uploading" || step === "extracting"} />

        {/* Extraction status */}
        {step !== "idle" && (
          <div className="rounded-2xl p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
              Extraction Progress
            </p>
            <ExtractionStatus step={step} error={error} />
          </div>
        )}

        {/* Criteria */}
        {result && <CriteriaList data={result} />}

        {/* Generated form fields */}
        {clinicalFields.length > 0 && (
          <div className="rounded-2xl p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid rgba(14,165,233,0.15)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)" }}>
                <ListChecks size={14} style={{ color: "var(--teal-400)" }} />
              </div>
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Enrollment form now collects
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {clinicalFields.map((f) => (
                <span key={f.key} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  {f.label}{f.unit ? ` (${f.unit})` : ""}
                  {f.is_exclusion && <span className="text-amber-400 font-bold ml-1">excl</span>}
                </span>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
              These fields are now live on the{" "}
              <span style={{ color: "var(--teal-400)" }}>Patient Enrollment</span> page for this trial.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
