"use client";

interface AgentStatusDotProps {
  status: "active" | "idle" | "error";
  label: string;
}

const STATUS_CONFIG = {
  active: { color: "#4ADE80", glow: "rgba(74,222,128,0.4)", label: "Active"  },
  idle:   { color: "#60A5FA", glow: "rgba(96,165,250,0.4)", label: "Idle"    },
  error:  { color: "#F87171", glow: "rgba(248,113,113,0.4)", label: "Error"  },
};

export default function AgentStatusDot({ status, label }: AgentStatusDotProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex-shrink-0">
        <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
        {status === "active" && (
          <div className="absolute inset-0 rounded-full animate-ping"
            style={{ background: cfg.color, opacity: 0.4 }} />
        )}
      </div>
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide" style={{ color: cfg.color }}>
        {cfg.label}
      </span>
    </div>
  );
}
