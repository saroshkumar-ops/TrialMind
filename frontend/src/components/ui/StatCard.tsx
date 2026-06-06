"use client";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  accentColor?: string;
  className?: string;
}

const TREND_ICON  = { up: "↑", down: "↓", neutral: "—" };
const TREND_COLOR = {
  up:      "text-green-400",
  down:    "text-red-400",
  neutral: "text-slate-500",
};

export default function StatCard({
  label, value, sub, icon, trend,
  accentColor = "var(--teal-400)",
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:translate-y-[-2px] group ${className}`}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl opacity-80"
        style={{ background: accentColor }} />

      {/* Background glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
        style={{ background: `radial-gradient(ellipse at top left, ${accentColor}08 0%, transparent 60%)` }} />

      {/* Content */}
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            {label}
          </p>
          {icon && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${accentColor}14`, border: `1px solid ${accentColor}25`, color: accentColor }}>
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold leading-none tracking-tight" style={{ color: accentColor }}>
            {value}
          </span>
          {trend && (
            <span className={`text-sm font-bold mb-1 ${TREND_COLOR[trend]}`}>
              {TREND_ICON[trend]}
            </span>
          )}
        </div>

        {sub && (
          <p className="text-xs mt-2 font-medium" style={{ color: "var(--text-muted)" }}>{sub}</p>
        )}
      </div>
    </div>
  );
}
