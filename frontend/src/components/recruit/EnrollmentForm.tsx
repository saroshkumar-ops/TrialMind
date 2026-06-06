"use client";
import { useForm } from "react-hook-form";
import { EnrollField } from "@/types/trial";
import { User, Activity, Pill, Info, Loader2, ArrowRight } from "lucide-react";

export type EnrollFormValues = Record<string, string | number | boolean>;

interface EnrollmentFormProps {
  fields: EnrollField[];
  trialName: string;
  onSubmit: (data: EnrollFormValues) => Promise<void>;
  loading?: boolean;
}

const GROUP_META: Record<string, { title: string; icon: React.ReactNode }> = {
  demographic: { title: "Personal details",              icon: <User     size={14} style={{ color: "#2B6BC4" }} /> },
  clinical:    { title: "Clinical measurements",         icon: <Activity size={14} style={{ color: "#2B6BC4" }} /> },
  retention:   { title: "Medical history & logistics",   icon: <Pill     size={14} style={{ color: "#2B6BC4" }} /> },
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  fontSize: 13,
  background: "#FFFFFF",
  border: "0.5px solid #C8D2DC",
  borderRadius: 8,
  color: "#1C2B3A",
  outline: "none",
  transition: "border-color 150ms ease, box-shadow 150ms ease",
  fontFamily: "inherit",
};

function FieldLabel({ field }: { field: EnrollField }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600,
      color: "#6B7A8D",
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      marginBottom: 5,
    }}>
      {field.label}
      {field.unit && (
        <span style={{ color: "#9BA8B5", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
          ({field.unit})
        </span>
      )}
      {field.required && <span style={{ color: "#B83434" }}>*</span>}
    </label>
  );
}

function FocusInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={inputStyle}
      onFocus={e => {
        e.currentTarget.style.borderColor = "#3D7ED8";
        e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(61,126,216,0.15)";
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = "#C8D2DC";
        e.currentTarget.style.boxShadow   = "none";
      }}
    />
  );
}

function FocusSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{ ...inputStyle, cursor: "pointer" }}
      onFocus={e => {
        e.currentTarget.style.borderColor = "#3D7ED8";
        e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(61,126,216,0.15)";
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = "#C8D2DC";
        e.currentTarget.style.boxShadow   = "none";
      }}
    />
  );
}

export default function EnrollmentForm({ fields, trialName, onSubmit, loading }: EnrollmentFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<EnrollFormValues>();

  const onValid = async (values: EnrollFormValues) => {
    const payload: EnrollFormValues = {};
    for (const f of fields) {
      const raw = values[f.key];
      if (f.type === "number") {
        if (raw !== "" && raw !== undefined && raw !== null) payload[f.key] = Number(raw);
      } else if (f.type === "boolean") {
        payload[f.key] = Boolean(raw);
      } else {
        if (raw !== undefined && raw !== "") payload[f.key] = raw;
      }
    }
    await onSubmit(payload);
  };

  const groups: Array<EnrollField["group"]> = ["demographic", "clinical", "retention"];

  return (
    <form onSubmit={handleSubmit(onValid)} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Subtitle */}
      <p style={{ fontSize: 12, color: "#6B7A8D", margin: 0 }}>
        Fields are generated from{" "}
        <span style={{ color: "#1A458A", fontWeight: 500 }}>{trialName}</span>'s protocol criteria.
      </p>

      {/* Field groups */}
      {groups.map((group) => {
        const groupFields = fields.filter(f => f.group === group);
        if (groupFields.length === 0) return null;
        const meta     = GROUP_META[group];
        const booleans = groupFields.filter(f => f.type === "boolean");
        const inputs   = groupFields.filter(f => f.type !== "boolean");

        return (
          <div key={group} style={{
            background: "#FFFFFF",
            border: "0.5px solid #E4E8EE",
            borderRadius: 12,
            padding: "18px 18px 20px",
            boxShadow: "0 1px 4px rgba(28,43,58,0.05)",
          }}>
            {/* Group header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "#EEF4FE", border: "0.5px solid #BAD0F5",
              }}>
                {meta.icon}
              </div>
              <h3 style={{ fontSize: 13, fontWeight: 500, color: "#1C2B3A", margin: 0 }}>
                {meta.title}
              </h3>
            </div>

            {/* Input fields grid */}
            {inputs.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 14,
                marginBottom: booleans.length > 0 ? 16 : 0,
              }}>
                {inputs.map(f => (
                  <div key={f.key}>
                    <FieldLabel field={f} />
                    {f.type === "select" ? (
                      <FocusSelect
                        defaultValue=""
                        {...register(f.key, { required: f.required ? `${f.label} required` : false })}
                      >
                        <option value="" disabled>Select…</option>
                        {(f.options ?? []).map(o => (
                          <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>
                        ))}
                      </FocusSelect>
                    ) : (
                      <FocusInput
                        type={f.type === "number" ? "number" : "text"}
                        step={f.type === "number" ? "any" : undefined}
                        placeholder={
                          f.placeholder ??
                          (f.type === "number" && f.min !== undefined ? `${f.min}–${f.max ?? ""}` : "")
                        }
                        {...register(f.key, {
                          required: f.required ? `${f.label} required` : false,
                          ...(f.type === "number" && f.min !== undefined
                            ? { min: { value: f.min, message: `Min ${f.min}` } } : {}),
                          ...(f.type === "number" && f.max !== undefined
                            ? { max: { value: f.max, message: `Max ${f.max}` } } : {}),
                        })}
                      />
                    )}
                    {errors[f.key] && (
                      <p style={{ fontSize: 11, color: "#B83434", marginTop: 4 }}>
                        {String(errors[f.key]?.message)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Boolean checkboxes */}
            {booleans.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 10,
                paddingTop: inputs.length > 0 ? 14 : 0,
                borderTop: inputs.length > 0 ? "0.5px solid #EDF0F4" : "none",
              }}>
                {booleans.map(f => (
                  <label key={f.key} htmlFor={f.key} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    cursor: "pointer",
                  }}>
                    <input
                      id={f.key}
                      type="checkbox"
                      {...register(f.key)}
                      style={{
                        marginTop: 2, width: 15, height: 15,
                        accentColor: "#2B6BC4", flexShrink: 0, cursor: "pointer",
                      }}
                    />
                    <span style={{ fontSize: 13, color: "#3D4F60", lineHeight: 1.5 }}>
                      {f.label}
                      {f.is_exclusion && (
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          color: "#7A4E0A",
                          background: "#FFF8EC",
                          border: "0.5px solid #F5D9A0",
                          borderRadius: 4,
                          padding: "1px 6px",
                          marginLeft: 7,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}>
                          exclusion
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Info notice */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "11px 14px", borderRadius: 10,
        background: "#EEF4FE",
        border: "0.5px solid #BAD0F5",
      }}>
        <Info size={14} style={{ color: "#2B6BC4", flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: "#1A458A", lineHeight: 1.6, margin: 0 }}>
          Your data is evaluated against this trial's eligibility criteria. If eligible, you'll be
          shown the consent form. No data is shared without your consent.
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || fields.length === 0}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "12px 0",
          borderRadius: 10,
          fontSize: 13, fontWeight: 500,
          border: "none",
          cursor: loading || fields.length === 0 ? "not-allowed" : "pointer",
          background: loading || fields.length === 0 ? "#F0F4F8" : "#2B6BC4",
          color: loading || fields.length === 0 ? "#9BA8B5" : "#FFFFFF",
          transition: "all 160ms ease",
        }}
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Checking eligibility…
          </>
        ) : (
          <>
            Submit &amp; check eligibility
            <ArrowRight size={14} />
          </>
        )}
      </button>
    </form>
  );
}