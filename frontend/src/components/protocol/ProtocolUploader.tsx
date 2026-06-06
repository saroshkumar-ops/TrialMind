"use client";
import { useState, useRef } from "react";
import { Upload, CheckCircle, X, Loader2 } from "lucide-react";

interface ProtocolUploaderProps {
  onUpload: (file: File) => void;
  loading?: boolean;
}

export default function ProtocolUploader({ onUpload, loading }: ProtocolUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState<File | null>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".pdf")) return;
    setFile(f);
    onUpload(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  /* ── shared container style ── */
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 32px",
    borderRadius: 14,
    cursor: file ? "default" : "pointer",
    transition: "all 200ms ease",
    border: `1.5px dashed ${
      dragging ? "#3D7ED8" :
      file      ? "#B4DACC" :
      "#C8D2DC"
    }`,
    background:
      dragging ? "#EEF4FE" :
      file      ? "#EAF5F0" :
      "#FAFBFC",
    outline: "none",
  };

  return (
    <div
      style={containerStyle}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !file && !loading && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload protocol PDF"
      onKeyDown={(e) => e.key === "Enter" && !file && !loading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {/* ── File selected ── */}
      {file ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#FFFFFF",
            border: "0.5px solid #B4DACC",
          }}>
            <CheckCircle size={24} style={{ color: "#2D8A65" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#0A6644", margin: 0 }}>{file.name}</p>
            <p style={{ fontSize: 11, color: "#6B7A8D", marginTop: 3 }}>
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setFile(null); }}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, fontWeight: 500,
              color: "#8B1F1F",
              background: "#FEF2F2",
              border: "0.5px solid #F5C0C0",
              borderRadius: 6,
              padding: "5px 12px",
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            <X size={11} /> Remove file
          </button>
        </div>
      ) : loading ? (

      /* ── Loading ── */
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#EEF4FE",
            border: "0.5px solid #BAD0F5",
          }}>
            <Loader2 size={20} style={{ color: "#2B6BC4" }} className="animate-spin" />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#1A458A", margin: 0 }}>
              Extracting protocol criteria…
            </p>
            <p style={{ fontSize: 11, color: "#6B7A8D", marginTop: 3 }}>
              LLM parsing inclusion &amp; exclusion rules
            </p>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#3D7ED8",
                animation: "pulse-dot 1.2s ease-in-out infinite",
                animationDelay: `${i * 200}ms`,
              }} />
            ))}
          </div>
        </div>

      ) : (

      /* ── Idle / drag target ── */
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: dragging ? "#EEF4FE" : "#F0F4F8",
            border: `0.5px solid ${dragging ? "#BAD0F5" : "#D0D8E2"}`,
            transition: "all 200ms ease",
          }}>
            <Upload size={22} style={{ color: dragging ? "#2B6BC4" : "#6B7A8D" }} />
          </div>

          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#1C2B3A", margin: 0 }}>
              Drop trial protocol PDF here
            </p>
            <p style={{ fontSize: 12, color: "#6B7A8D", marginTop: 4 }}>
              or click to browse · PDF files only
            </p>
          </div>

          <span style={{
            fontSize: 11, fontWeight: 500,
            padding: "5px 14px", borderRadius: 999,
            background: "#EEF4FE",
            border: "0.5px solid #BAD0F5",
            color: "#1A458A",
            letterSpacing: "0.01em",
          }}>
            AI extracts inclusion &amp; exclusion criteria automatically
          </span>
        </div>
      )}
    </div>
  );
}