# TrialMind — Remaining Build Plan (no-Java architecture)

**Architecture (locked):** Frontend → **Python AIML service** (FastAPI). No Java
backend; Python owns the data layer via **SQLite**, seeded from the Synthea FHIR
bundles + adherence overlay on first startup.
See [end-to-end-flow.md](end-to-end-flow.md) and [frontend-workflow.md](frontend-workflow.md).

## Where we actually are right now

| Track | Status | Summary |
|---|---|---|
| **AIML (Python)** | 🟢 ~97% | All intelligence endpoints + the **data layer** (SQLite, 222 seeded patients, trial store, self-enroll) + **Phase 3 monitoring** (IsolationForest safety + efficacy trajectory + composite escalation). Phases 0–3 verified end to end. |
| **Frontend (Next.js)** | 🔴 ~10% — scaffold only | `types/`, `lib/api/`, `hooks/`, and all pages still empty. **Now the critical path** — it's the only thing judges see. |
| **Java backend** | ⚫ removed | `backend/` deleted; responsibilities ported to Python. |

**The gap is now 100% the frontend** (+ optional Phase 3+ monitoring models).

---

## Immediate priority — wire Phases 0–2 (frontend)

The AIML side of Phases 0–2 is **done and verified**. Frontend tasks:

1. **`types/*.ts`** from [end-to-end-flow.md](end-to-end-flow.md) — the contract.
2. **`lib/api/*`** (axios, base URL = `NEXT_PUBLIC_AIML_URL`) + **`hooks/*`** (React Query).
3. **Screening spine:** `/screening` ranked table → patient drawer (`orchestrate`) →
   HITL banner. This is the demo climax — build it end to end first.
4. **Breadth:** `/protocol` upload → `/recruit` self-enroll → `/diversity` →
   `/adherence` → `/audit` → `/dashboard`.
5. **Polish:** loading / empty / error states.

Run the service: `cd aiml && uvicorn app:app --reload --port 8000` (auto-seeds SQLite).

---

## Day-5 tuning (after the spine works)
- **Engineer one "golden" patient** + align the default trial's criteria so the demo
  shows a clean ELIGIBLE → HIGH risk → escalation → HITL path. (See the "known
  wrinkles" in [end-to-end-flow.md](end-to-end-flow.md).)
- Add a **`GROQ_API_KEY`** to `aiml/.env` so explanations use the LLM, not the stub.
- Deploy the AIML service (Docker / Railway / Render); set `NEXT_PUBLIC_AIML_URL`.

## Phase 3 — active monitoring ✅ (AIML done; needs a frontend page)
Built + verified: `POST /patients/{id}/visit` runs an **IsolationForest** safety
anomaly model + an **efficacy trajectory** model + dropout risk + adherence →
`monitoring_status` + composite escalation + audit. Plus `GET /patients/{id}/visits`,
`POST /monitoring/anomaly`, `POST /monitoring/efficacy`. The safety model auto-trains
on first startup (`python -m monitoring.train_anomaly` to retrain).
**Remaining:** a `/monitoring` frontend page (visit form + trajectory chart + reuse the
HITL banner) — see [frontend-workflow.md](frontend-workflow.md).
*Production upgrade path (say to judges, don't build): swap IsolationForest → LSTM
autoencoder (same I/O); periodic retraining behind a clinician-approved sign-off.*

## Optional — Phases 4–5 (only after the demo path is rehearsed)
Visit-over-visit dropout early-warning + cohort efficacy summary + auto-generated
trial report (Groq). Don't start until Phases 0–3 are wired and rehearsed.

## Two rules that decide whether we win
1. If behind, cut depth, never the end-to-end path.
2. Protect the escalation + HITL moment — that's the 20 seconds judges remember.
