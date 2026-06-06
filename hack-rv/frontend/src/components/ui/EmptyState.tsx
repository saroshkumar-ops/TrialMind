"use client";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
      {icon && (
        <div className="mb-5 p-4 rounded-2xl animate-float"
          style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.15)", color: "var(--teal-400)" }}>
          {icon}
        </div>
      )}
      <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>{title}</h3>
      {description && (
        <p className="text-sm max-w-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
