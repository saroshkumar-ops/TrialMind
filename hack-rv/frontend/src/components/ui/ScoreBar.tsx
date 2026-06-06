"use client";

interface ScoreBarProps {
  value: number;          // 0–1
  colorScheme?: "risk" | "confidence" | "neutral";
  showLabel?: boolean;
  height?: number;
  className?: string;
}

function getGradient(value: number, colorScheme: string) {
  if (colorScheme === "confidence") return "linear-gradient(90deg, #0EA5E9, #06B6D4)";
  if (colorScheme === "neutral")    return "linear-gradient(90deg, #475569, #64748B)";
  if (value < 0.35) return "linear-gradient(90deg, #22C55E, #4ADE80)";
  if (value < 0.65) return "linear-gradient(90deg, #F59E0B, #FBBF24)";
  return "linear-gradient(90deg, #EF4444, #F87171)";
}

function getGlowColor(value: number, colorScheme: string) {
  if (colorScheme === "confidence") return "rgba(14,165,233,0.4)";
  if (colorScheme === "neutral")    return "rgba(100,116,139,0.3)";
  if (value < 0.35) return "rgba(34,197,94,0.4)";
  if (value < 0.65) return "rgba(245,158,11,0.4)";
  return "rgba(239,68,68,0.4)";
}

export default function ScoreBar({
  value,
  colorScheme = "risk",
  showLabel = true,
  height = 6,
  className = "",
}: ScoreBarProps) {
  const pct   = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  const grad  = getGradient(value, colorScheme);
  const glow  = getGlowColor(value, colorScheme);

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex-1 rounded-full overflow-hidden" style={{ height, background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full relative"
          style={{
            width: `${pct}%`,
            background: grad,
            transition: "width .6s cubic-bezier(.4,0,.2,1)",
            boxShadow: `0 0 8px ${glow}`,
          }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono w-8 text-right font-semibold" style={{ color: "var(--text-secondary)" }}>
          {pct}%
        </span>
      )}
    </div>
  );
}
