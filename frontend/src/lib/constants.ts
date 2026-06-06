// src/lib/constants.ts
// Frontend calls Python AIML service directly — no Java backend

export const AIML_BASE_URL =
  process.env.NEXT_PUBLIC_AIML_URL ?? "http://localhost:8000";

// Default trial ID used throughout the app
export const DEFAULT_TRIAL_ID = "default-t2dm";

// Default actor for HITL actions
export const DEFAULT_ACTOR = "dr.chen";