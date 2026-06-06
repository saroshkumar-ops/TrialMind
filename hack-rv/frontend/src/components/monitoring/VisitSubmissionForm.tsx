"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { SubmitVisitRequest } from "@/types/monitoring";
import { Activity, Calendar } from "lucide-react";

interface VisitSubmissionFormProps {
  onSubmit: (data: Omit<SubmitVisitRequest, "trial_id">) => Promise<void>;
  loading?: boolean;
}

type FormValues = {
  visit_date: string;
  heart_rate: string;
  systolic_bp: string;
  hba1c: string;
  glucose: string;
  weight: string;
};

const inputCls = "w-full px-3 py-2.5 text-sm bg-[--bg-elevated] border border-[--border] rounded-lg text-[--text-primary] placeholder-[--text-muted] focus:outline-none focus:border-[--teal-500] transition-colors";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-[--text-secondary] uppercase tracking-wider">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
    </div>
  );
}

export default function VisitSubmissionForm({ onSubmit, loading }: VisitSubmissionFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      visit_date: new Date().toISOString().split("T")[0],
    },
  });

  const onValid = async (values: FormValues) => {
    await onSubmit({
      visit_date: new Date(values.visit_date).toISOString(),
      vitals: {
        heart_rate: values.heart_rate ? Number(values.heart_rate) : undefined,
        systolic_bp: values.systolic_bp ? Number(values.systolic_bp) : undefined,
        hba1c: values.hba1c ? Number(values.hba1c) : undefined,
        glucose: values.glucose ? Number(values.glucose) : undefined,
        weight: values.weight ? Number(values.weight) : undefined,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-6">
      <div className="bg-[--bg-surface] border border-[--border] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Calendar size={14} className="text-teal-400" />
          <h3 className="text-sm font-semibold text-[--text-primary]">Visit Info</h3>
        </div>

        <Field label="Visit Date" error={errors.visit_date?.message}>
          <input
            type="date"
            {...register("visit_date", { required: "Date is required" })}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="bg-[--bg-surface] border border-[--border] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={14} className="text-teal-400" />
          <h3 className="text-sm font-semibold text-[--text-primary]">Vitals & Biomarkers</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Heart Rate (bpm)" error={errors.heart_rate?.message}>
            <input type="number" {...register("heart_rate")} placeholder="72" className={inputCls} />
          </Field>
          <Field label="Systolic BP (mmHg)" error={errors.systolic_bp?.message}>
            <input type="number" {...register("systolic_bp")} placeholder="120" className={inputCls} />
          </Field>
          <Field label="HbA1c (%)" error={errors.hba1c?.message}>
            <input type="number" step="0.1" {...register("hba1c")} placeholder="7.0" className={inputCls} />
          </Field>
          <Field label="Glucose (mg/dL)" error={errors.glucose?.message}>
            <input type="number" {...register("glucose")} placeholder="100" className={inputCls} />
          </Field>
          <Field label="Weight (kg)" error={errors.weight?.message}>
            <input type="number" step="0.1" {...register("weight")} placeholder="70" className={inputCls} />
          </Field>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-teal-500 hover:bg-teal-600 text-white transition-colors disabled:opacity-60"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Analyzing Data…
          </>
        ) : (
          "Submit Reading →"
        )}
      </button>
    </form>
  );
}
