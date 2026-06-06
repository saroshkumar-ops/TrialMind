# TrialMind — Project Context

> **A clinical-trial optimization platform** built for a hackathon ("HackSoc"/"hack-rv"). It uses explainable AI to extract trial protocols, screen patients for eligibility, predict dropout risk, monitor adherence, synthesize cross-agent findings, and keep a tamper-evident audit trail — all on top of synthetic patient data (Synthea FHIR), with a human-in-the-loop clinician gate.

This document is a self-contained context summary intended to be pasted into any LLM so it can understand the whole project.

## Architecture decision — **no-Java (locked; supersedes the old "Option A")**

**Python (AIML) is the brain AND owns the data layer. There is no Java backend.**
- **Python** owns all intelligence (protocol extraction, screening, risk, escalation, HITL, hash-chained audit) **and** the data layer: a **SQLite** store (`aiml/data/trialmind.db`) seeded from the Synthea FHIR bundles + adherence overlay on first startup.
- **Frontend** talks **directly** to the Python AIML service (FastAPI, `http://localhost:8000`). No gateway hop.
- The old Java `backend/` folder was **deleted**; its data-ingestion + feature-assembly responsibilities were ported into `aiml/data_layer/`.

The exact request trace is in `docs/end-to-end-flow.md`. Mental shortcut:
> **Frontend sends an ID → Python turns the ID into data (SQLite) → Python turns data into a decision → back to the frontend.**

## High-level architecture

Two-tier monorepo under `hack-rv/`:

| Tier | Tech | Location | Status |
|------|------|----------|--------|
| **AIML service (brain + data)** | Python · FastAPI · SQLite · Groq LLM · XGBoost · SHAP · scikit-learn | `aiml/` | 🟢 **~95%** — intelligence endpoints + data layer; Phases 0–2 verified end to end |
| **Frontend** | Next.js 16 · React 19 · TanStack Query · Tailwind v4 · axios | `frontend/` | 🔴 **~10% — scaffold only**; types/hooks/pages empty. **Now the critical path.** |
| **Data** | Synthea (synthetic FHIR R4 generator) | `data/` | 🟢 **222 patient bundles** committed in `data/seed/fhir/` (seed 7) |

**Data flow:** On first boot the AIML service parses `data/seed/fhir/*.json` + the adherence overlay into SQLite (222 patients + a default T2DM trial). Frontend calls Python directly: `GET /trials/{id}/screen-cohort` (Tier 1 bulk) and `POST /patients/{id}/orchestrate` (Tier 2) — Python assembles all payloads from SQLite internally.

**Data layer (`aiml/data_layer/`):** `db.py` (SQLite schema), `registry.py` (cohort seed + feature assembly + self-enroll), `trial_store.py` (trials + extracted criteria).

## Docs (the team playbook, in `docs/`)
- `data-field-mapping.md` — Synthea FHIR → feature mapping (the data contract).
- `end-to-end-flow.md` — exact Frontend→Python call trace with real JSON at every hop.
- `backend-tasks.md` — **DEPRECATED** (Java removed); points to the Python data layer.
- `remaining-build-plan.md` — current-state day-by-day plan (Days 3–6), role-split.
- `why-india.md` — India-specific problem framing + sources for the pitch deck.

## The data contract

`docs/data-field-mapping.md` defines the Synthea→Postgres mapping. Patient UUID (strip `urn:uuid:` prefix from `subject.reference`) is the join key. Key LOINC codes: HbA1c=`4548-4`, Glucose=`2339-0`, BMI=`39156-5`.

**Demo scenario:** a *"Type 2 Diabetes Management Trial"* — inclusion: age 18–75 + (T2DM or Prediabetes) + HbA1c 6.5–9.0; exclusion: diabetic kidney disease or HbA1c >9.0. The cohort (Synthea seed 7, 222 patients) was generated to produce both matches and rejections.

**Honest caveat (stated in code):** Synthea has no trial dropout label or adherence data, so the AIML side **synthesizes** these — dropout labels + missed-visit/travel-distance features + the adherence timeline are engineered for the demo; in production they'd come from real trial outcomes.

## AIML service — the brain (`aiml/`)

FastAPI app (`app.py`) exposing **~15 endpoints**; starts even without a trained model or Groq key:

| Endpoint | Module | What it does |
|----------|--------|--------------|
| `GET /health`, `/model-info` | — | Liveness + model metadata |
| `POST /extract-protocol` | `protocol/parser.py` | Groq LLM extracts inclusion/exclusion criteria from raw protocol **text**; regex fallback if Groq unconfigured |
| `POST /extract-protocol-pdf` | `protocol/parser.py` | Same, but accepts a **PDF upload** (extracts text first) |
| `POST /screen-patient` | `screening/screening_engine.py` | Rule-based matcher for ONE patient; ELIGIBLE / INELIGIBLE / REQUIRES_REVIEW with cited evidence + confidence |
| `POST /screen-cohort` | `app.py` | **Tier 1 bulk screen:** rules + risk for a WHOLE cohort in one call (NO LLM, NO audit); ranked list; ~2.3s for 222 patients |
| `POST /predict-risk` | `prediction/predictor.py` | XGBoost dropout score + top-5 SHAP factors (model trained, **ROC-AUC ≈ 0.87** on 222 patients) |
| `POST /analyze-data` | `app.py` (Data Agent) | Biomarker-spike detection from an Observation time-series → `{biomarker_spike, detail}` (standalone; not wired into orchestrate) |
| `POST /fairness-audit` | `fairness/fairness_audit.py` | Gender/age distribution + underrepresentation warnings |
| `POST /explain-eligibility` | `utils/groq_client.py` | Groq plain-English rationale for a decision |
| `POST /consent-summary` | `utils/groq_client.py` | Patient-friendly plain-language protocol summary |
| `POST /orchestrate` | `app.py` + below | **Tier 2 full pipeline (one patient):** extract → screen → risk → escalation → explanation → audit; returns one consolidated object + `audit_id` |
| `POST /hitl-review` | `audit/audit_trail.py` | Clinician APPROVE / OVERRIDE / ESCALATE; writes a linked audit entry |
| `GET /audit-trail` | `audit/audit_trail.py` | Hash-chained (SHA-256, `prev_hash`) tamper-evident log; returns `chain_valid` |
| `GET /adherence-overlay` | `app.py` | Serves the per-patient adherence overlay (status + deviation alerts) |

**Synthesis/escalation** (`synthesis/escalation_engine.py`, deterministic, no LLM): escalates when risk HIGH + adherence non-compliant, or risk HIGH + screening REQUIRES_REVIEW, etc.

**Offline pipeline scripts (deterministic, `RNG_SEED=7`):**
- `prediction/build_dataset.py` — FHIR bundles → `data/training_data.csv` (real features + synthesized dropout label).
- `prediction/train.py` — `python prediction/train.py <csv> <target>` → `models/{risk_model,preprocessor,feature_names}.pkl`.
- `adherence/adherence_overlay.py` — simulates a 6-visit/28-day trial + daily dosing → `data/adherence_overlay.json` (per-patient status + deviation alerts).
- `explainability/shap_explainer.py` — SHAP TreeExplainer wrapper.

**The 11 risk features** the backend must send to `/predict-risk` (or `/orchestrate`): `age, gender, comorbidity_count, has_comorbidity, num_encounters, avg_visit_gap_days, num_medications, hba1c, bmi, glucose, missed_visits, travel_distance_km` (last two come from the adherence overlay, not FHIR).

Config via `.env` (`GROQ_API_KEY`, `GROQ_MODEL=llama-3.3-70b-versatile`). **Run:** `cd aiml && uvicorn app:app --reload --port 8000` (Swagger at `/docs`). `test_all_endpoints.py` covers all routes.

## Data layer (`aiml/data_layer/`) — replaces the deleted Java backend

Python now owns the data, in **SQLite** (`aiml/data/trialmind.db`, gitignored, rebuilt on first boot):
- **`db.py`** — schema: `patients` (id, name, demographics, labs, kidney_disease, `features_json`, `adherence_json`, source, trial_id, cached screening_decision) + `trials` (id, name, protocol_text, inclusion/exclusion JSON).
- **`registry.py`** — `seed_cohort()` parses all 222 FHIR bundles (reusing `prediction.build_dataset` for feature parity with training), merges the adherence overlay, and persists. Plus `list_patients` / `get_patient` / feature & screening payload assembly / `add_patient` (self-enroll).
- **`trial_store.py`** — trial CRUD + a seeded default T2DM trial; `update_criteria()` stores criteria extracted from an uploaded protocol PDF.

**Endpoints the frontend calls** (all in `aiml/app.py`): `GET/POST /trials`, `GET /trials/{id}`, `POST /trials/{id}/protocol`, `GET /patients`, `GET /patients/{id}`, `POST /patients`, `GET /trials/{id}/screen-cohort` (Tier 1), `POST /patients/{id}/orchestrate` (Tier 2). **Phases 0–2 are verified end to end.** The Java `backend/` folder was deleted.

## Phase 3 — active monitoring (`aiml/monitoring/`)

Enrolled patients are monitored per visit. `POST /patients/{id}/visit` runs a composite monitor and persists to a `visits` table + the audit log:
- **Safety (`vitals_anomaly.py`):** an **IsolationForest** trained on the cohort's vital panel `[hba1c, glucose, bmi, heart_rate, weight]`; flags multivariate outlier readings + names the driving vital (per-vital z-scores). Auto-trains on first startup; retrain via `python -m monitoring.train_anomaly`. *(LSTM-autoencoder is the documented production upgrade — same contract.)*
- **Efficacy (`efficacy.py`):** interpretable trajectory model comparing a biomarker's observed change vs the protocol-expected response → `on_track`/`above_expected`/`below_expected`, attributed to adherence + visit regularity.
- **Composite (`monitor.py`):** safety + efficacy + dropout risk + adherence → `monitoring_status` (stable/watch/alert) + deterministic escalation + audit entry.

Other Phase 3 endpoints: `GET /patients/{id}/visits`, `POST /monitoring/anomaly`, `POST /monitoring/efficacy`. **Phase 3 is verified end to end** (stable baseline → on-track response → dangerous spike → alert+escalation, audit chain valid).

## Frontend (`frontend/`)

Named "trialmind". **Only the landing page is implemented** (Navbar, Hero, HowItWorks, Features, Footer). Everything functional is still an empty stub: route pages (`/dashboard`, `/screening`, `/risk`, `/adherence`, `/diversity`, `/audit`, `/protocol`, `/review`, + new `/recruit`), API clients (`lib/api/*`), TanStack Query hooks (`hooks/use*`), and TS types (`types/*`) are **0-byte**. They call the Python AIML service **directly** (base URL `NEXT_PUBLIC_AIML_URL`) — see `docs/frontend-workflow.md`.

⚠️ Note from `frontend/AGENTS.md`: Next.js 16 has breaking changes — consult `node_modules/next/dist/docs/` before writing frontend code.

## Summary of completeness
- 🟢 **AIML service**: ~97% — intelligence endpoints + SQLite data layer + Phase 3 monitoring (IsolationForest safety + efficacy + composite escalation). Trained risk model (AUC ≈ 0.87), escalation, hash-chained audit, HITL, self-enroll, bulk cohort screen. Phases 0–3 verified end to end. Remaining: Groq key + Day-5 criteria tuning.
- 🟢 **Synthetic data + pipelines**: complete and reproducible (222 patients, seed 7).
- ⚫ **Java backend**: removed; ported to `aiml/data_layer/` (SQLite).
- 🔴 **Frontend**: ~10% — landing page only; the bottleneck and the only thing judges see.
