"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { monitoringApi } from "@/lib/api/monitoringApi";
import { VitalScenario, VitalsTick } from "@/types/monitoring";
import {
  Heart, Activity, Wind, Droplet, Gauge, Thermometer,
  ShieldAlert, AlertTriangle, CheckCircle, Play, Pause, Radio,
} from "lucide-react";

const TICK_MS = 30_000; // bedside machines push a reading every 30s

interface Props {
  patientId: string;
  patientName: string;
}

const STATUS_STYLE: Record<string, { bar: string; text: string; ring: string; label: string }> = {
  stable:   { bar: "bg-green-500", text: "text-green-300", ring: "border-green-500/30 bg-green-500/8", label: "STABLE" },
  watch:    { bar: "bg-amber-500", text: "text-amber-300", ring: "border-amber-500/30 bg-amber-500/8", label: "WATCH" },
  critical: { bar: "bg-red-500",   text: "text-red-300",   ring: "border-red-500/40 bg-red-500/10",    label: "CRITICAL" },
};

const SEV_TEXT: Record<string, string> = { normal: "text-[--text-primary]", warn: "text-amber-300", crit: "text-red-300" };
const SEV_DOT: Record<string, string> = { normal: "bg-green-400", warn: "bg-amber-400", crit: "bg-red-400" };

function worst(a?: string, b?: string) {
  const rank: Record<string, number> = { normal: 0, warn: 1, crit: 2 };
  return (rank[a ?? "normal"] >= rank[b ?? "normal"] ? a : b) ?? "normal";
}

export default function LiveVitalsPanel({ patientId, patientName }: Props) {
  const [tick, setTick] = useState<VitalsTick | null>(null);
  const [hrHistory, setHrHistory] = useState<number[]>([]);
  const [scenario, setScenario] = useState<VitalScenario>("normal");
  const [streaming, setStreaming] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hitlState, setHitlState] = useState<"idle" | "saving" | "done">("idle");
  const scenarioRef = useRef<VitalScenario>("normal");
  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);

  const doTick = useCallback(async (sc: VitalScenario) => {
    if (!patientId) return;
    setLoading(true);
    try {
      const t = await monitoringApi.vitalsTick(patientId, sc);
      setTick(t);
      setHrHistory((h) => [...h.slice(-15), t.vitals.heart_rate]);
      if (t.status !== "critical") setHitlState("idle");
    } catch (e) {
      console.error("vitals tick failed", e);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  // First reading on mount (deferred a tick so it doesn't setState during the effect
  // body). The page keys this component by patientId, so it remounts per patient.
  useEffect(() => {
    const t = setTimeout(() => doTick("normal"), 0);
    return () => clearTimeout(t);
  }, [doTick]);

  // Live stream: a fresh reading every 30s using the active scenario.
  useEffect(() => {
    if (!streaming) return;
    const id = setInterval(() => doTick(scenarioRef.current), TICK_MS);
    return () => clearInterval(id);
  }, [streaming, doTick]);

  const pick = (sc: VitalScenario) => { setScenario(sc); doTick(sc); };

  const acknowledge = async (action: "APPROVE" | "ESCALATE") => {
    if (!tick?.audit_id) return;
    setHitlState("saving");
    try {
      const AIML_URL = process.env.NEXT_PUBLIC_AIML_URL ?? "http://localhost:8000";
      await fetch(`${AIML_URL}/hitl-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: tick.audit_id, action, actor: "dr.chen" }),
      });
      setHitlState("done");
    } catch { setHitlState("idle"); }
  };

  const s = STATUS_STYLE[tick?.status ?? "stable"];
  const v = tick?.vitals ?? {};
  const vs = tick?.vital_status ?? {};

  const cards = [
    { key: "heart_rate", label: "Heart rate", unit: "bpm", icon: Heart, sev: vs.heart_rate, value: v.heart_rate },
    { key: "bp", label: "Blood pressure", unit: "mmHg", icon: Activity,
      sev: worst(vs.systolic_bp, vs.diastolic_bp),
      value: v.systolic_bp != null ? `${v.systolic_bp}/${v.diastolic_bp}` : undefined },
    { key: "spo2", label: "SpO₂", unit: "%", icon: Wind, sev: vs.spo2, value: v.spo2 },
    { key: "glucose", label: "Glucose", unit: "mg/dL", icon: Droplet, sev: vs.glucose, value: v.glucose },
    { key: "respiratory_rate", label: "Resp. rate", unit: "/min", icon: Gauge, sev: vs.respiratory_rate, value: v.respiratory_rate },
    { key: "temperature", label: "Temperature", unit: "°C", icon: Thermometer, sev: vs.temperature, value: v.temperature },
  ];

  // HR sparkline
  const spark = (() => {
    if (hrHistory.length < 2) return null;
    const w = 220, h = 34, min = Math.min(...hrHistory), max = Math.max(...hrHistory);
    const span = Math.max(max - min, 1);
    const pts = hrHistory.map((val, i) => {
      const x = (i / (hrHistory.length - 1)) * w;
      const y = h - ((val - min) / span) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return (
      <svg width={w} height={h} className="overflow-visible">
        <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.6"
          className={tick?.status === "critical" ? "text-red-400" : tick?.status === "watch" ? "text-amber-400" : "text-teal-400"} />
      </svg>
    );
  })();

  return (
    <div className="space-y-4">
      {/* Stream header */}
      <div className="flex items-center justify-between gap-3 bg-[--bg-surface] border border-[--border] rounded-xl px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5">
            {streaming && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-60" />}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${streaming ? "bg-teal-400" : "bg-[--text-muted]"}`} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[--text-primary] flex items-center gap-1.5">
              <Radio size={13} className="text-teal-400" /> Live bedside feed
            </p>
            <p className="text-[11px] text-[--text-muted]">
              {streaming ? "Streaming - updates every 30s" : "Paused"}
              {tick && ` · last ${new Date(tick.timestamp).toLocaleTimeString()}`}
              {loading && " · reading…"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setStreaming((x) => !x)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[--border] text-[--text-secondary] hover:text-[--text-primary] hover:border-teal-500 transition-colors"
        >
          {streaming ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Resume</>}
        </button>
      </div>

      {/* Scenario controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[--text-muted] mr-1">Simulate machine input:</span>
        {([
          ["normal", "Normal", "border-green-500/40 text-green-300 bg-green-500/10"],
          ["moderate", "Moderate", "border-amber-500/40 text-amber-300 bg-amber-500/10"],
          ["critical", "Critical", "border-red-500/40 text-red-300 bg-red-500/10"],
        ] as [VitalScenario, string, string][]).map(([sc, label, active]) => (
          <button
            key={sc}
            onClick={() => pick(sc)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              scenario === sc ? active : "border-[--border] text-[--text-secondary] hover:text-[--text-primary] hover:border-teal-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status banner */}
      <div className={`flex items-start gap-4 p-4 rounded-xl border ${s.ring}`}>
        <span className="mt-0.5">
          {tick?.status === "critical" ? <ShieldAlert size={26} className="text-red-400" /> :
           tick?.status === "watch" ? <AlertTriangle size={26} className="text-amber-400" /> :
           <CheckCircle size={26} className="text-green-400" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[--text-muted]">Patient status</p>
            {spark && <span className="text-[--text-muted]">{spark}</span>}
          </div>
          <p className={`text-lg font-bold ${s.text}`}>{s.label}</p>
          <p className="text-xs text-[--text-secondary] mt-0.5">{tick?.detail}</p>
        </div>
      </div>

      {/* Vitals grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          const sev = c.sev ?? "normal";
          return (
            <div key={c.key} className={`bg-[--bg-surface] border rounded-xl p-3 ${
              sev === "crit" ? "border-red-500/40" : sev === "warn" ? "border-amber-500/40" : "border-[--border]"
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] text-[--text-muted]">
                  <Icon size={13} className={SEV_TEXT[sev]} /> {c.label}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${SEV_DOT[sev]}`} />
              </div>
              <p className={`text-xl font-bold tabular-nums ${SEV_TEXT[sev]}`}>
                {c.value ?? "--"}
                <span className="text-[11px] font-medium text-[--text-muted] ml-1">{c.unit}</span>
              </p>
            </div>
          );
        })}
      </div>

      {/* Alerts + HITL on critical */}
      {tick?.status === "critical" && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/8 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-400" />
            <p className="text-sm font-bold text-red-300">Safety alert - clinician action required</p>
          </div>
          <ul className="text-xs text-red-300/90 space-y-1">
            {tick.alerts.map((a, i) => <li key={i} className="flex gap-1.5"><span>⚠</span> {a}</li>)}
          </ul>
          <p className="text-[11px] text-[--text-muted]">Logged to audit trail · ref {tick.audit_id}</p>
          {hitlState === "done" ? (
            <div className="flex items-center gap-2 text-green-300 text-sm font-semibold">
              <CheckCircle size={16} /> Action recorded for {patientName}
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => acknowledge("APPROVE")} disabled={hitlState === "saving"}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30 transition-colors disabled:opacity-50">
                Acknowledge &amp; intervene
              </button>
              <button onClick={() => acknowledge("ESCALATE")} disabled={hitlState === "saving"}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                Escalate to senior
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
