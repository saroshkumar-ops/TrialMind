"use client";
import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  dismissible?: boolean;
  className?: string;
}

export default function ErrorBanner({ message, dismissible = true, className = "" }: ErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl px-4 py-3 animate-fadeIn ${className}`}
      style={{
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.25)",
        boxShadow: "0 0 16px rgba(239,68,68,0.06)",
      }}
      role="alert"
    >
      <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-sm text-red-300">{message}</p>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="text-red-500 hover:text-red-300 transition-colors"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
