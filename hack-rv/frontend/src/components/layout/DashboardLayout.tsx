"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FlaskConical, Users, ShieldCheck,
  Activity, ClipboardList, Dna, UserPlus,
  ChevronLeft, ChevronRight, Bell, Menu, X,
} from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/dashboard",  label: "Dashboard",      icon: LayoutDashboard, group: "main"    },
  { href: "/protocol",   label: "Protocol",        icon: FlaskConical,    group: "main"    },
  { href: "/recruit",    label: "Enroll patient",  icon: UserPlus,        group: "main"    },
  { href: "/screening",  label: "Screening",       icon: Users,           group: "main"    },
  { href: "/monitoring", label: "Active monitor",  icon: Activity,        group: "monitor" },
  { href: "/diversity",  label: "Diversity",       icon: Dna,             group: "monitor" },
  { href: "/adherence",  label: "Adherence",       icon: Activity,        group: "monitor" },
  { href: "/audit",      label: "Audit trail",     icon: ClipboardList,   group: "control" },
  { href: "/review",     label: "HITL review",     icon: ShieldCheck,     group: "control" },
];

const NAV_GROUPS = [
  { key: "main",    label: "Workflow"  },
  { key: "monitor", label: "Monitor"   },
  { key: "control", label: "Controls"  },
];

function AgentDot({ label, status }: { label: string; status: "active" | "idle" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
        background: status === "active" ? "#2D8A65" : "#9BA8B5",
      }} />
      <span style={{ fontSize: 12, color: "#3D4F60", flex: 1 }}>{label}</span>
      <span style={{
        fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 999,
        textTransform: "uppercase" as const, letterSpacing: "0.04em",
        background: status === "active" ? "#EAF5F0" : "#F0F4F8",
        color: status === "active" ? "#0A6644" : "#6B7A8D",
      }}>
        {status}
      </span>
    </div>
  );
}

function SidebarContent({
  path,
  collapsed,
  onClose,
}: {
  path: string;
  collapsed: boolean;
  onClose?: () => void;
}) {
  return (
    <>
      {/* Brand */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: collapsed ? "16px 0" : "16px 18px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderBottom: "0.5px solid #E4E8EE",
        minHeight: 64,
        flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: "#2B6BC4",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 600, fontSize: 14,
          fontFamily: "'Lora', Georgia, serif",
          flexShrink: 0,
          position: "relative" as const,
        }}>
          T
          <span style={{
            position: "absolute" as const, top: -3, right: -3,
            width: 8, height: 8, borderRadius: "50%",
            background: "#2D8A65",
            border: "2px solid #FFFFFF",
          }} />
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1C2B3A", lineHeight: 1, fontFamily: "'Lora', Georgia, serif" }}>
              TrialMind
            </p>
            <p style={{ fontSize: 10, color: "#6B7A8D", marginTop: 2, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
              AI Clinical Co-Pilot
            </p>
          </div>
        )}
        {onClose && (
          <button onClick={onClose} style={{ marginLeft: "auto", color: "#6B7A8D", background: "none", border: "none", cursor: "pointer", display: "flex" }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: collapsed ? "16px 8px" : "16px 12px", overflowY: "auto" as const }}>
        {NAV_GROUPS.map((group, gi) => {
          const items = NAV.filter(n => n.group === group.key);
          return (
            <div key={group.key} style={{ marginBottom: gi < NAV_GROUPS.length - 1 ? 24 : 0 }}>
              {!collapsed && (
                <p style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
                  textTransform: "uppercase" as const, color: "#9BA8B5",
                  padding: "0 8px", marginBottom: 6,
                }}>
                  {group.label}
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
                {items.map(({ href, label, icon: Icon }) => {
                  const active = path === href || (href !== "/dashboard" && path.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={collapsed ? label : undefined}
                      onClick={onClose}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: collapsed ? 0 : 10,
                        padding: collapsed ? "9px 0" : "8px 10px",
                        justifyContent: collapsed ? "center" : "flex-start",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: active ? 500 : 400,
                        color: active ? "#1A458A" : "#3D4F60",
                        background: active ? "#EEF4FE" : "transparent",
                        borderLeft: active && !collapsed ? "2.5px solid #2B6BC4" : "2.5px solid transparent",
                        textDecoration: "none",
                        transition: "all 140ms ease",
                      }}
                    >
                      <Icon
                        size={15}
                        style={{ flexShrink: 0, color: active ? "#2B6BC4" : "#6B7A8D" }}
                      />
                      {!collapsed && <span style={{ whiteSpace: "nowrap" as const }}>{label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentPage = NAV.find(
    n => path === n.href || (n.href !== "/dashboard" && path.startsWith(n.href))
  );

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#F7F8FA" }}>

      {/* ── Desktop sidebar ── */}
      <aside style={{
        width: collapsed ? 56 : 220,
        flexShrink: 0,
        display: "flex" as const,
        flexDirection: "column" as const,
        background: "#FFFFFF",
        borderRight: "0.5px solid #E4E8EE",
        transition: "width 260ms cubic-bezier(.4,0,.2,1)",
        position: "relative" as const,
        overflow: "hidden",
      }}
        className="hidden md:flex"
      >
        <SidebarContent path={path} collapsed={collapsed} />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label="Toggle sidebar"
          style={{
            position: "absolute" as const,
            right: -12, top: 76,
            width: 24, height: 24,
            borderRadius: "50%",
            background: "#FFFFFF",
            border: "0.5px solid #C8D2DC",
            boxShadow: "0 1px 4px rgba(28,43,58,0.10)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            color: "#6B7A8D",
            zIndex: 10,
          }}
        >
          {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
        </button>
      </aside>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div style={{ position: "fixed" as const, inset: 0, zIndex: 50, display: "flex" }} className="md:hidden">
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: "absolute" as const, inset: 0, background: "rgba(28,43,58,0.35)" }}
          />
          <aside style={{
            position: "relative" as const,
            width: 220,
            display: "flex",
            flexDirection: "column" as const,
            background: "#FFFFFF",
            borderRight: "0.5px solid #E4E8EE",
            animation: "slideInLeft .25s cubic-bezier(.4,0,.2,1) both",
          }}>
            <SidebarContent path={path} collapsed={false} onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, overflow: "hidden", minWidth: 0 }}>

        {/* Topbar */}
        <header style={{
          flexShrink: 0,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          background: "#FFFFFF",
          borderBottom: "0.5px solid #E4E8EE",
        }}>
          {/* Left */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden"
              style={{ color: "#6B7A8D", background: "none", border: "none", cursor: "pointer", display: "flex" }}
            >
              <Menu size={18} />
            </button>
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <span style={{ color: "#9BA8B5", fontWeight: 400 }}>TrialMind</span>
              <span style={{ color: "#C8D2DC" }}>/</span>
              <span style={{ color: "#1C2B3A", fontWeight: 500 }}>
                {currentPage?.label ?? (path.replace("/", "") || "Home")}
              </span>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Trial pill */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 999,
              background: "#EAF5F0",
              border: "0.5px solid #B4DACC",
              fontSize: 11, fontWeight: 500, color: "#0A6644",
              letterSpacing: "0.03em",
            }}
              className="hidden sm:flex"
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2D8A65", flexShrink: 0 }} />
              Trial #1 — Active
            </div>

            {/* Bell */}
            <button style={{
              width: 32, height: 32, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "none", border: "0.5px solid #E4E8EE",
              cursor: "pointer", color: "#6B7A8D",
              position: "relative" as const,
            }}>
              <Bell size={15} />
              <span style={{
                position: "absolute" as const, top: 6, right: 6,
                width: 6, height: 6, borderRadius: "50%",
                background: "#C94040",
                border: "1.5px solid #FFFFFF",
              }} />
            </button>

            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#2B6BC4",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600, color: "#fff",
              letterSpacing: "0.04em",
            }}>
              DC
            </div>
          </div>
        </header>

        {/* Page */}
        <main style={{ flex: 1, overflowY: "auto" as const }}>
          {children}
        </main>
      </div>
    </div>
  );
}