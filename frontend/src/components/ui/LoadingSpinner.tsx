"use client";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const SIZE   = { sm: "w-4 h-4", md: "w-8 h-8", lg: "w-12 h-12" };
const BORDER = { sm: "border-2", md: "border-2", lg: "border-[3px]" };

export default function LoadingSpinner({ size = "md", label, className = "" }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="relative">
        <div
          className={`${SIZE[size]} ${BORDER[size]} rounded-full`}
          style={{
            borderColor: "rgba(14,165,233,0.15)",
            borderTopColor: "var(--teal-500)",
            animation: "spin .7s linear infinite",
            boxShadow: "0 0 12px rgba(14,165,233,0.2)",
          }}
        />
      </div>
      {label && (
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
      )}
    </div>
  );
}
