"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  ArrowRight, AlertTriangle, FileText, UserPlus, Dna,
  LineChart, Scale, Pill, ShieldCheck, Users, CheckCircle,
  AlertCircle, AlertOctagon, Activity, Clock, Bot,
  ChevronRight, History,
} from "lucide-react";

const AIML_URL = process.env.NEXT_PUBLIC_AIML_URL ?? "http://localhost:8000";

const QUICK_LINKS = [
  { href: "/protocol",   label: "Upload protocol",    desc: "Extract criteria from PDF",       icon: FileText,   color: "#0F6E56", bg: "#E1F5EE" },
  { href: "/recruit",    label: "Enroll patient",     desc: "AI screening on submit",          icon: UserPlus,   color: "#3B6D11", bg: "#EAF3DE" },
  { href: "/screening",  label: "Screen cohort",      desc: "Bulk eligibility & risk",         icon: Dna,        color: "#185FA5", bg: "#E6F1FB" },
  { href: "/monitoring", label: "Active monitoring",  desc: "Submit vitals & track",           icon: LineChart,  color: "#534AB7", bg: "#EEEDFE" },
  { href: "/diversity",  label: "Fairness audit",     desc: "Demographic representation",      icon: Scale,      color: "#854F0B", bg: "#FAEEDA" },
  { href: "/adherence",  label: "Adherence monitor",  desc: "Protocol deviation alerts",       icon: Pill,       color: "#A32D2D", bg: "#FCEBEB" },
];

export default function DashboardPage() {
  const [totalPatients, setTotalPatients] = useState<number | null>(null);
  const [eligible,      setEligible]      = useState<number | null>(null);
  const [escalations,   setEscalations]   = useState<number | null>(null);
  const [highRisk,      setHighRisk]      = useState<number | null>(null);
  const [highDeviations,setHighDeviations]= useState(0);
  const [recentEntries, setRecentEntries] = useState<
    { id: string; timestamp: string; action: string; actor: string; patient_id?: string }[]
  >([]);

  useEffect(() => {
    fetch(`${AIML_URL}/patients`)
      .then(r => r.json()).then(d => setTotalPatients(d.total ?? 0)).catch(() => {});

    fetch(`${AIML_URL}/trials/default-t2dm/screen-cohort`)
      .then(r => r.json()).then(d => {
        setEligible(d.summary?.ELIGIBLE ?? 0);
        setHighRisk((d.results ?? []).filter((p: { risk_level: string }) => p.risk_level === "HIGH").length);
      }).catch(() => {});

    fetch(`${AIML_URL}/audit-trail?limit=5`)
      .then(r => r.json()).then(d => {
        setEscalations((d.entries ?? []).filter((e: { action: string }) => e.action === "ESCALATION").length);
        setRecentEntries((d.entries ?? []).slice(0, 5));
      }).catch(() => {});

    fetch(`${AIML_URL}/adherence-overlay`)
      .then(r => r.json()).then(d => {
        const alerts = (d.patients ?? []).flatMap((p: { alerts?: { severity: string }[] }) => p.alerts ?? []);
        setHighDeviations(alerts.filter((a: { severity: string }) => a.severity === "HIGH").length);
      }).catch(() => {});
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const stats = [
    { label: "Total patients", value: totalPatients, sub: "in registry",    accent: "#1D9E75" },
    { label: "Eligible",       value: eligible,      sub: "for Trial #1",   accent: "#639922" },
    { label: "Escalations",    value: escalations,   sub: "pending review", accent: "#E24B4A" },
    { label: "High risk",      value: highRisk,      sub: "patients",       accent: "#BA7517" },
  ];

  return (
    <DashboardLayout>
      <div style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "36px 28px",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
              Trial #1 · T2DM Study
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 400, lineHeight: 1.2, color: "var(--text-primary)", fontFamily: "'Lora', Georgia, serif" }}>
              Good morning, Dr. Chen
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 5, fontWeight: 300 }}>{today}</p>
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            fontSize: 12, fontWeight: 500,
            padding: "7px 14px", borderRadius: 999,
            border: "0.5px solid var(--border)",
            color: "var(--text-secondary)",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2ecc71", display: "inline-block" }} />
            Active · Enrolling
          </div>
        </div>

        {/* ── Escalation Alert ── */}
        {escalations !== null && escalations > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "14px 18px", borderRadius: 12, marginBottom: 24,
            background: "rgba(226,75,74,0.07)",
            border: "0.5px solid rgba(226,75,74,0.3)",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(226,75,74,0.12)", flexShrink: 0,
            }}>
              <AlertTriangle size={16} color="#E24B4A" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#E24B4A", margin: 0 }}>
                {escalations} escalation{escalations > 1 ? "s" : ""} pending clinician review
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Flagged patients require your attention before proceeding.
              </p>
            </div>
            <Link href="/screening" style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, fontWeight: 500, color: "#E24B4A",
              border: "0.5px solid rgba(226,75,74,0.35)",
              padding: "7px 13px", borderRadius: 7,
              textDecoration: "none",
            }}>
              Review <ArrowRight size={12} />
            </Link>
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 24 }}>
          {stats.map(s => (
            <div key={s.label} style={{
              borderRadius: 12, padding: "16px 16px 14px",
              background: "var(--bg-surface)",
              border: "0.5px solid var(--border)",
              borderTop: `2.5px solid ${s.accent}`,
            }}>
              <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
                {s.label}
              </p>
              <p style={{ fontSize: 30, fontWeight: 300, lineHeight: 1, color: "var(--text-primary)", marginBottom: 4 }}>
                {s.value ?? "—"}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Mid Row: Agents + Quick Actions ── */}
        <div style={{ marginBottom: 24 }}>

          {/* Quick Actions */}
          <div
            style={{
              borderRadius: 12,
              padding: "20px",
              background: "var(--bg-surface)",
              border: "0.5px solid var(--border)",
              width: "100%",
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>
              Quick actions
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {QUICK_LINKS.map(l => {
                const Icon = l.icon;
                return (
                  <Link key={l.href} href={l.href} style={{
                    display: "flex", alignItems: "center", gap: 11,
                    padding: "11px 13px", borderRadius: 8,
                    border: "0.5px solid var(--border)",
                    background: "var(--bg-elevated)",
                    textDecoration: "none",
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: l.bg, color: l.color,
                    }}>
                      <Icon size={15} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>{l.label}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{l.desc}</p>
                    </div>
                  </Link>
                );
              })}
              <Link href="/audit" style={{
                gridColumn: "span 2",
                display: "flex", alignItems: "center", gap: 11,
                padding: "11px 13px", borderRadius: 8,
                border: "0.5px solid var(--border)",
                background: "var(--bg-elevated)",
                textDecoration: "none",
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#FAECE7", color: "#993C1D" }}>
                  <ShieldCheck size={15} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>Audit trail</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Hash-chained tamper-evident log</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <div style={{ borderRadius: 12, background: "var(--bg-surface)", border: "0.5px solid var(--border)", overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderBottom: "0.5px solid var(--border)",
          }}>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <History size={13} /> Recent activity
            </p>
            <Link href="/audit" style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
              Full log <ChevronRight size={12} />
            </Link>
          </div>

          {recentEntries.length === 0 ? (
            <p style={{ textAlign: "center", padding: "28px 18px", fontSize: 13, color: "var(--text-muted)" }}>
              No recent activity.
            </p>
          ) : (
            recentEntries.map((e, i) => (
              <div key={e.id} style={{
                display: "flex", alignItems: "flex-start", gap: 14,
                padding: "12px 18px",
                borderBottom: i < recentEntries.length - 1 ? "0.5px solid var(--border)" : "none",
              }}>
                {/* Timeline connector */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 3, flexShrink: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid var(--text-secondary)", background: "var(--bg-surface)" }} />
                  {i < recentEntries.length - 1 && (
                    <div style={{ width: 1, flex: 1, background: "var(--border)", minHeight: 18, marginTop: 3 }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{e.action}</span>
                  {e.patient_id && (
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 6 }}>— {e.patient_id}</span>
                  )}
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{e.actor}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", marginTop: 2, flexShrink: 0 }}>
                  <Clock size={10} />
                  {new Date(e.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}