# End-to-End Flow (no-Java architecture) — exact trace, every hop

> **Architecture change (locked):** there is **no Java backend anymore.** The
> frontend talks **directly to the Python AIML service** (FastAPI, port 8000).
> Python now owns the data layer too — a **SQLite** store (`aiml/data/trialmind.db`)
> seeded from the Synthea FHIR bundles + the adherence overlay on first startup.

Mental shortcut:
> **Frontend sends an ID → Python turns the ID into data (SQLite) → Python turns
> data into a decision → back to the frontend.**

Two-tier screening (unchanged in spirit, just no Java hop):
- **Tier 1 — bulk cohort screen** = cheap path (rules + risk only, NO LLM, NO audit).
  Screens the WHOLE cohort live in ~3s via `GET /trials/{id}/screen-cohort`.
- **Tier 2 — single-patient deep-dive** = full `POST /patients/{id}/orchestrate`
  (evidence + SHAP + escalation + Groq explanation + audit). One patient at a time.

This doc covers **Phases 0–2** (protocol → recruitment → screening/enrollment),
which are wired and working today.

---

## STEP 0 — PHASE 0: protocol setup (once per trial)

A default demo trial (`default-t2dm`) is seeded at startup, so screening works even
before any upload. Uploading a PDF overwrites its criteria.

1. **Frontend** (`/protocol`): drag in the PDF.
2. **Frontend → Python** `POST /trials/{trialId}/protocol` (multipart, field `file`).
3. **Python** extracts text (pypdf) → criteria (Groq, or regex fallback) → stores
   `protocol_text` + `inclusion[]`/`exclusion[]` on the trial row (SQLite).
4. **Python** returns the updated trial:
   ```json
   { "trial_id": "default-t2dm", "name": "...", "protocol_text": "...",
     "inclusion": ["Age 18-75","HbA1c 6.5-9.0","BMI 25-40"],
     "exclusion": ["Chronic kidney disease","Pregnancy"], "created_at": "..." }
   ```
5. **Frontend** shows the extracted criteria as chips.

To create a *new* trial instead of using the default: `POST /trials`.

---

## STEP 1 — PHASE 1: patient recruitment (self-enroll)

1. **Frontend** (`/recruit`): patient fills the enrollment form.
2. **Frontend → Python** `POST /patients`
   ```json
   { "name":"Jane Doe","age":54,"gender":"female","hba1c":7.4,"bmi":31.0,
     "glucose":140,"kidney_disease":false,"comorbidity_count":2,
     "missed_visits":3,"travel_distance_km":55,"trial_id":"default-t2dm" }
   ```
3. **Python** stores the patient (source=`self-enroll`), builds its risk features, and
   — if `trial_id` is given — auto-screens it and caches the decision. Returns:
   ```json
   { "patient": { "patient_id":"enr-2a5dea8d08", "name":"Jane Doe", ... ,
                  "features": {...}, "screening_decision":"REQUIRES_REVIEW" },
     "auto_screen": { "decision":"REQUIRES_REVIEW", "confidence":0.55, "evidence":[...] } }
   ```
4. The 222 pre-seeded Synthea patients (source=`synthea`) are already in the registry;
   self-enrolled patients are added alongside them.

---

## STEP 2 — PHASE 2: screening + enrollment

### Tier 1 — bulk cohort screen (live, all patients, ~3s)
1. **Frontend** (`/screening`) → `GET /trials/{trialId}/screen-cohort`
   (optional `?source=synthea` or `?source=self-enroll` to filter the cohort).
2. **Python** loads the trial's criteria + every patient from SQLite, assembles each
   patient's screening dict + 12 risk features **internally**, runs rules+risk for all
   (NO Groq, NO audit), and returns a ranked, lightweight list:
   ```json
   { "total": 222,
     "summary": { "ELIGIBLE": 7, "REQUIRES_REVIEW": 69, "INELIGIBLE": 146 },
     "results": [
       { "patient_id":"ef4d...", "name":"Jefferson H.", "decision":"REQUIRES_REVIEW",
         "confidence":0.55, "risk_level":"HIGH", "risk_score":0.9987,
         "risk_unavailable":false }
       /* eligible first, then by descending risk */
     ] }
   ```
3. **Frontend** renders the ranked shortlist.

### Tier 2 — drill into ONE patient (full pipeline)
1. **Frontend** → `POST /patients/{patientId}/orchestrate`
   body `{ "trial_id":"default-t2dm", "actor":"dr.chen" }`
2. **Python** pulls the patient's features + adherence from SQLite and the trial's
   `protocol_text` from the trial store, then runs the full pipeline:
   extract → screen → risk+SHAP → escalation → Groq explanation → **hash-chained
   audit write** → returns one object:
   ```json
   { "patient_id":"326f...", "screening_decision":"ELIGIBLE", "screening_confidence":0.88,
     "screening_evidence":["[INCLUSION] HbA1c 7.6 satisfies 6.5-9.0", "..."],
     "risk_score":0.97, "risk_level":"HIGH",
     "risk_top_factors":[{"feature":"age","impact":1.22}, ...],
     "escalation":{ "escalated":true, "severity":"high",
       "reason":"HIGH dropout risk AND non-compliant adherence.",
       "recommended_action":"Immediate clinical review." },
     "eligibility_explanation":"This 53-year-old patient meets all inclusion criteria...",
     "audit_id":"b9626a1d" }
   ```
3. **Frontend** renders: evidence "why?" accordion · risk bar + colour chip + SHAP
   chart · adherence status · if `escalation.escalated` → escalation banner (keep `audit_id`).

### HITL — clinician acts
1. **Frontend** → `POST /hitl-review`
   `{ "audit_id":"b9626a1d", "action":"OVERRIDE", "actor":"dr.chen", "override_reason":"..." }`
2. **Python** appends a linked audit entry, returns
   `{ "status":"recorded", "review_audit_id":"...", "references_audit_id":"b9626a1d" }`.

---

## STEP 3 — PHASE 3: active monitoring (enrolled patients)

Once a patient is enrolled, each follow-up visit records a vitals reading and runs a
**composite monitor**: a safety model + an efficacy model + dropout risk + adherence,
with deterministic escalation and an audit entry.

- **Safety (anomaly):** an **IsolationForest** trained on the cohort's vital panel
  (`[hba1c, glucose, bmi, heart_rate, weight]`). Flags a multivariate outlier reading
  and names the driving vital via per-vital z-scores. *(LSTM-autoencoder is the
  documented production upgrade — same I/O contract.)*
- **Efficacy (treatment response):** compares a biomarker's observed trajectory to the
  protocol-expected response (e.g. HbA1c ≈ −0.5%/3mo) → `on_track` / `above_expected`
  / `below_expected`, with adherence + visit-regularity attribution.

1. **Frontend** (`/monitoring`) → `POST /patients/{id}/visit`
   ```json
   { "trial_id":"default-t2dm", "visit_date":"2026-07-15",
     "vitals": { "hba1c":13.8, "glucose":390, "heart_rate":152, "bmi":31, "weight":90 } }
   ```
2. **Python** runs safety + efficacy (built from this patient's prior visits + the new
   reading) + re-runs dropout risk + reads adherence, then escalates if any composite
   rule fires. Persists the visit (`visits` table) + writes a `MONITORING_VISIT` audit
   entry (and an `ESCALATION` entry when triggered). Returns:
   ```json
   { "patient_id":"326f...", "visit_id":"vis-...", "visit_date":"2026-07-15",
     "monitoring_status":"alert",
     "safety":{ "is_anomaly":true, "anomaly_score":0.76,
                "drivers":[{"vital":"glucose","value":390,"z":27.1}],
                "detail":"Anomalous reading: glucose=390 is 27.1σ above the cohort mean." },
     "efficacy":{ "status":"below_expected", "pct_of_expected":20.3, "detail":"..." },
     "dropout":{ "risk_level":"HIGH", "risk_score":0.97 },
     "adherence_status":"at_risk",
     "escalation":{ "escalated":true, "severity":"high",
       "trigger_agents":["vital_anomaly","non_response_high_dropout"],
       "reason":"Safety: ... ; Efficacy below expected AND high dropout risk.",
       "recommended_action":"Immediate clinical review — safety + retention intervention." },
     "audit_id":"..." }
   ```
3. **Frontend** renders the monitoring status chip, vitals trajectory, efficacy verdict,
   and — if `escalation.escalated` — the same HITL banner (→ `POST /hitl-review`).

`GET /patients/{id}/visits` returns the full visit history (with `monitoring_status`
+ vitals per visit) for the trajectory chart.

**Escalation rules (deterministic):** `vital_anomaly` (any dangerous reading) **or**
`below_expected efficacy + HIGH dropout risk` **or** `non_compliant adherence +
below_expected efficacy`.

Standalone variants for one-off analysis: `POST /monitoring/anomaly` (score a reading),
`POST /monitoring/efficacy` (analyze a biomarker series).

---

## Supporting reads (also direct to Python)

| Page | Frontend → Python | Shows |
|---|---|---|
| **Diversity** `/diversity` | `POST /fairness-audit` (pass patient list) | demographic charts + warnings |
| **Adherence** `/adherence` | `GET /adherence-overlay` | deviation alerts feed |
| **Audit** `/audit` | `GET /audit-trail` | timestamped log + 🔒 `chain_valid` badge |

---

## Endpoint cheat-sheet (Phases 0–2)

| Frontend → Python | Purpose |
|---|---|
| `GET  /trials` · `POST /trials` · `GET /trials/{id}` | trial store |
| `POST /trials/{id}/protocol` | upload PDF, store extracted criteria |
| `GET  /patients` · `GET /patients/{id}` | patient registry (222 seeded + self-enrolled) |
| `POST /patients` | self-enroll (+ optional auto-screen) |
| `GET  /trials/{id}/screen-cohort` | **Tier 1** — bulk ranked list (cheap) |
| `POST /patients/{id}/orchestrate` | **Tier 2** — full single-patient pipeline |
| `POST /hitl-review` | clinician approve/override/escalate |
| `GET  /audit-trail` · `POST /fairness-audit` · `GET /adherence-overlay` | dashboards |
| `POST /patients/{id}/visit` | **Phase 3** — record a monitoring visit (safety+efficacy+escalation) |
| `GET  /patients/{id}/visits` | Phase 3 — visit history / trajectory |
| `POST /monitoring/anomaly` · `POST /monitoring/efficacy` | Phase 3 — standalone safety / efficacy |

## Known wrinkles (non-blocking, tune on Day 5)
- **Two criteria sources:** Tier-1 screen uses the trial's stored `inclusion/exclusion`
  arrays directly; Tier-2 `orchestrate` re-extracts criteria from `protocol_text`. They
  can disagree (e.g. "Type 2 diabetes" is unverifiable in the rule engine → REQUIRES_REVIEW
  in Tier-1, but the fallback parser may not emit it → ELIGIBLE in Tier-2). For a clean
  demo, engineer one "golden" patient and align the default trial's criteria.
- **No ELIGIBLE in the default cohort** until criteria are tuned — expected; it's a
  screening-rule tuning task, not an architecture issue.
- CORS is already `*` on the FastAPI app, so the Next.js dev server can call it directly.
