// src/lib/api/client.ts
// Shared axios instance pointing directly at the Python AIML FastAPI service
import axios from "axios";
import { AIML_BASE_URL } from "@/lib/constants";

export const apiClient = axios.create({
  baseURL: AIML_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error("[AIML API]", err?.response?.status, err?.config?.url, err?.message);
    return Promise.reject(err);
  }
);
