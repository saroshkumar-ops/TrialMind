# TrialMind AIML Microservice

> **FastAPI · Groq LLM · XGBoost + SHAP · Hash-chained Audit Trail**
>
> The AI/ML brain of TrialMind. Runs independently on port **8000** and is called by the Spring Boot backend via REST.

---

## Quick Start

```bash
cd aiml/
cp .env.example .env          # then fill in GROQ_API_KEY
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Interactive API docs → **http://localhost:8000/docs**

---

## Environment Variables (`.env`)

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `GROQ_API_KEY` | ✅ Yes | — | Get one free at [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | Any Groq chat model |
| `APP_ENV` | No | `development` | |
| `LOG_LEVEL` | No | `INFO` | |

> **All Groq endpoints have fallbacks** — the service starts and responds correctly even without a key. Set `GROQ_API_KEY` for LLM-powered extraction and explanations.

---

## Architecture

```
aiml/
├── app.py                      ← FastAPI entry point (all 14 endpoints)
├── protocol/
│   └── parser.py               ← Groq LLM or regex criteria extraction
├── screening/
│   └── screening_engine.py     ← Rule-based eligibility matcher
├── prediction/
│   ├── predictor.py            ← XGBoost risk prediction (lazy-loads model)
│   ├── train.py                ← Model training script
│   └── build_dataset.py        ← Synthea FHIR → feature matrix
├── explainability/
│   └── shap_explainer.py       ← SHAP top-5 factor explanations
├── fairness/
│   └── fairness_audit.py       ← Gender + age cohort analysis
├── adherence/
│   └── adherence_overlay.py    ← Synthetic trial adherence simulation
├── synthesis/
│   └── escalation_engine.py    ← Multi-agent escalation rules (no LLM)
├── audit/
│   └── audit_trail.py          ← SHA-256 hash-chained append-only log
├── schemas/
│   ├── patient_schema.py       ← Pydantic models: screening, risk, fairness
│   ├── protocol_schema.py      ← Pydantic models: protocol extraction
│   └── orchestration_schema.py ← Pydantic models: orchestrate, HITL, audit
└── utils/
    ├── config.py               ← Centralised settings (reads .env)
    ├── groq_client.py          ← Groq API helpers (extraction, explanation, consent)
    └── logger.py               ← Structured logger
```

---

## API Reference

All responses are JSON. Full interactive spec at `/docs` (Swagger UI) and `/redoc`.

### Infrastructure

#### `GET /health`
Service liveness + diagnostics.

```json
{
  "status": "ok",
  "service": "TrialMind AIML",
  "version": "1.0.0",
  "environment": "development",
  "groq_configured": true,
  "model_loaded": false
}
```

#### `GET /model-info`
XGBoost model metadata. Returns `"status": "not_trained"` gracefully when model files are absent.

---

### Protocol Extraction

#### `POST /extract-protocol`
Extract structured inclusion/exclusion criteria from raw protocol text.

**Request**
```json
{
  "protocol_text": "Inclusion Criteria:\n- Age 18–65\n- HbA1c 6.5–9.0\nExclusion Criteria:\n- Kidney disease"
}
```

**Response**
```json
{
  "inclusion": ["Age 18–65", "HbA1c 6.5–9.0"],
  "exclusion": ["Kidney disease"],
  "confidence": 0.95,
  "raw_text_length": 87
}
```

> Falls back to regex parsing when Groq is not configured.

#### `POST /extract-protocol-pdf`
Same as `/extract-protocol`, but accepts a PDF file upload. Uses `pypdf` to extract text before passing it to the extraction pipeline.

**Request**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: `file` field containing the `.pdf` file.

**Response**
Matches `/extract-protocol` response shape exactly.

---

### Screening

#### `POST /screen-patient`
Evaluate a patient against extracted trial criteria.

**Request**
```json
{
  "criteria": {
    "inclusion": ["Age 18–65", "HbA1c 6.5–9.0"],
    "exclusion": ["Kidney disease"]
  },
  "patient": {
    "age": 45,
    "hba1c": 7.2,
    "kidney_disease": false
  }
}
```

**Response**
```json
{
  "decision": "ELIGIBLE",
  "confidence": 0.97,
  "evidence": [
    "[INCLUSION] Age 45.0 satisfies requirement (18.0–65.0)",
    "[INCLUSION] Hba1c 7.2 satisfies requirement (6.5–9.0)",
    "[EXCLUSION] No Kidney Disease detected"
  ],
  "source_refs": ["age", "hba1c", "kidney_disease"]
}
```

`decision` is one of `ELIGIBLE` · `INELIGIBLE` · `REQUIRES_REVIEW`

---

### Risk Prediction

#### `POST /predict-risk`
Dropout risk prediction with SHAP explanations.

> ⚠️ **Returns 422** (not a crash) if the XGBoost model has not been trained yet. See [Training the Model](#training-the-model).

**Request**
```json
{
  "patient_features": {
    "age": 45,
    "missed_visits": 2,
    "travel_distance_km": 60.0,
    "has_comorbidity": 1
  }
}
```

**Response**
```json
{
  "risk_score": 0.7312,
  "risk_level": "HIGH",
  "top_factors": [
    { "feature": "missed_visits", "impact": 0.312 },
    { "feature": "travel_distance_km", "impact": 0.198 }
  ]
}
```

`risk_level` → `LOW` (score < 0.40) · `MEDIUM` (< 0.70) · `HIGH` (≥ 0.70)

---

### Data Agent (Biomarkers)

#### `POST /analyze-data`
Detects an abnormal spike in a biomarker time-series. Used as a signal for the Day-4 auto-escalation engine.

**Request**
```json
{
  "patient_id": "pt-001",
  "biomarker": "hba1c",
  "spike_threshold_pct": 20.0,
  "observations": [
    {"date": "2025-01-01", "value": 6.8},
    {"date": "2025-04-01", "value": 9.2}
  ]
}
```

**Response**
```json
{
  "patient_id": "pt-001",
  "biomarker": "hba1c",
  "biomarker_spike": true,
  "spike_magnitude_pct": 35.3,
  "latest_value": 9.2,
  "baseline_value": 6.8,
  "trend": "rising",
  "detail": "HBA1C spike detected: latest value 9.20 is 35.3% above baseline 6.80.",
  "n_observations": 2
}
```

---

### Fairness Audit

#### `POST /fairness-audit`
Demographic representation analysis for a cohort.

**Request**
```json
{
  "patients": [
    { "age": 35, "gender": "male" },
    { "age": 52, "gender": "female" },
    { "age": 68, "gender": "female" }
  ]
}
```

**Response**
```json
{
  "total_patients": 3,
  "gender_distribution": {
    "Female": { "count": 2, "percentage": 66.7 },
    "Male":   { "count": 1, "percentage": 33.3 }
  },
  "age_distribution": {
    "18–40 (young adult)": { "count": 1, "percentage": 33.3 },
    "40–60 (middle-aged)": { "count": 1, "percentage": 33.3 },
    "60+ (elderly)":       { "count": 1, "percentage": 33.3 }
  },
  "warnings": [],
  "recommendations": ["Cohort appears reasonably balanced..."]
}
```

---

### Explanation (Groq LLM)

#### `POST /explain-eligibility`
Human-readable 2–4 sentence explanation of an eligibility decision. Gracefully degrades to a rule-based fallback without Groq.

**Request**
```json
{
  "criteria": { "inclusion": ["Age 18–65"], "exclusion": ["Kidney disease"] },
  "patient": { "age": 45, "kidney_disease": false },
  "decision": "ELIGIBLE"
}
```

**Response**
```json
{
  "explanation": "The patient, aged 45, falls within the required age range of 18–65...",
  "decision": "ELIGIBLE",
  "generated_by": "groq/llama-3.3-70b-versatile"
}
```

#### `POST /consent-summary`
Patient-friendly plain-language summary (≤150 words) suitable for informed consent forms.

**Request**
```json
{ "protocol_text": "Raw clinical trial protocol text..." }
```

**Response**
```json
{
  "summary": "This study is testing a new treatment for type 2 diabetes...",
  "word_count": 87,
  "generated_by": "groq/llama-3.3-70b-versatile"
}
```

---

### Adherence Overlay

#### `GET /adherence-overlay`
Serves the pre-computed JSON file tracking patient adherence, missed visits, and travel distances.

**Query params**
| Param | Example | Effect |
|-------|---------|--------|
| `patient_id` | `?patient_id=pt-001` | Returns just the object for this patient |
| `status_filter` | `?status_filter=non_compliant` | Returns only patients matching status |

**Response (Summary mode)**
```json
{
  "summary": { "on_track": 13, "at_risk": 29, "non_compliant": 8 },
  "patients": [ ... ]
}
```

---

### End-to-End Orchestration 🌟

#### `POST /orchestrate`
**The main demo endpoint.** Chains the full pipeline in one call:
1. Protocol text → extract criteria (Groq / regex fallback)
2. Screen patient against criteria
3. Predict dropout risk (XGBoost)
4. Evaluate escalation rules (deterministic, no LLM)
5. Generate eligibility explanation (Groq / fallback)
6. Hash-log everything to audit trail

**Request**
```json
{
  "protocol_text": "Inclusion: Age 18–65, HbA1c 6.5–9.0\nExclusion: Kidney disease",
  "patient": {
    "age": 52,
    "hba1c": 7.8,
    "kidney_disease": false,
    "gender": "female"
  },
  "patient_features": {
    "age": 52,
    "missed_visits": 3,
    "travel_distance_km": 80.0,
    "has_comorbidity": 1
  },
  "adherence_record": {
    "adherence_status": "non_compliant",
    "adherence_rate": 0.62
  },
  "patient_id": "pt-001",
  "actor": "system",
  "include_explanation": true
}
```

**Response**
```json
{
  "patient_id": "pt-001",
  "criteria": { "inclusion": [...], "exclusion": [...], "confidence": 0.95 },
  "protocol_confidence": 0.95,
  "screening_decision": "ELIGIBLE",
  "screening_confidence": 0.97,
  "screening_evidence": ["[INCLUSION] Age 52.0 satisfies requirement (18.0–65.0)", "..."],
  "risk_score": 0.81,
  "risk_level": "HIGH",
  "risk_top_factors": [
    { "feature": "missed_visits", "impact": 0.34 }
  ],
  "risk_unavailable": false,
  "escalation": {
    "escalated": true,
    "reason": "Patient flagged HIGH dropout risk AND is non-compliant...",
    "trigger_agents": ["risk_agent", "adherence_agent"],
    "severity": "high",
    "recommended_action": "Immediate clinical review — consider protocol deviation notice..."
  },
  "eligibility_explanation": "The patient meets all inclusion criteria...",
  "audit_id": "3f8a1c2d-..."
}
```

> **Use `audit_id`** from the response to feed into `/hitl-review`.

---

### Human-in-the-Loop (HITL)

#### `POST /hitl-review`
Record a clinician's review action on an escalated decision. Every action is hash-logged and cross-references the original `audit_id`.

**Request**
```json
{
  "audit_id": "3f8a1c2d-...",
  "action": "APPROVE",
  "actor": "dr.chen",
  "patient_id": "pt-001",
  "notes": "Reviewed chart — all criteria confirmed."
}
```

`action` is one of:
- `APPROVE` — clinician agrees with the AI decision
- `OVERRIDE` — clinician reverses it (`override_reason` required)
- `ESCALATE` — escalate to senior reviewer

**Response**
```json
{
  "status": "recorded",
  "action": "APPROVE",
  "actor": "dr.chen",
  "review_audit_id": "9a2b3c4d-...",
  "references_audit_id": "3f8a1c2d-..."
}
```

---

### Audit Trail

#### `GET /audit-trail`
Returns the tamper-evident audit log, newest first. Every entry is SHA-256 linked to the previous.

**Query params**
| Param | Example | Effect |
|-------|---------|--------|
| `limit` | `?limit=50` | Max entries to return (default 100) |
| `action_filter` | `?action_filter=ESCALATION` | Filter by action type |
| `patient_id_filter` | `?patient_id_filter=pt-001` | Filter by patient |

**Response**
```json
{
  "total_entries": 12,
  "chain_valid": true,
  "chain_message": "Chain is valid. 12 entries verified.",
  "entries": [
    {
      "id": "9a2b3c4d-...",
      "timestamp": "2026-06-02T14:05:22.341Z",
      "action": "HITL_APPROVE",
      "patient_id": "pt-001",
      "actor": "dr.chen",
      "payload": { ... },
      "prev_hash": "abc123...",
      "hash": "def456..."
    }
  ]
}
```

**Action types logged automatically:**

| Action | Logged by |
|--------|-----------|
| `ORCHESTRATION` | `/orchestrate` |
| `ESCALATION` | `/orchestrate` (when escalation fires) |
| `HITL_APPROVE` | `/hitl-review` |
| `HITL_OVERRIDE` | `/hitl-review` |
| `HITL_ESCALATE` | `/hitl-review` |

---

## Training the Model

The risk model is **not required** to run the service — all endpoints except `/predict-risk` work without it. `/orchestrate` will set `risk_unavailable: true` gracefully.

To train:

```bash
# 1. Generate Synthea FHIR data (or use existing bundles in data/seed/fhir/)
# 2. Build the feature dataset
python3 prediction/build_dataset.py

# 3. Train the XGBoost model — pass the CSV and target column as arguments
python3 prediction/train.py data/training_data.csv dropout

# 4. Restart the service — model auto-loads on next request
.venv/bin/uvicorn app:app --reload --port 8000
```

Model files land in `models/risk_model.pkl`, `models/preprocessor.pkl`, `models/feature_names.pkl`.

---

## Generating Adherence Data

The adherence overlay script generates synthetic trial visit + dosing records for the demo:

```bash
python3 adherence/adherence_overlay.py
# → writes aiml/data/adherence_overlay.json
```

Feed the per-patient `adherence_record` from this file into the `adherence_record` field of `/orchestrate` for full escalation simulation.

---

## Running the Full Smoke Test

With the server running, in a second terminal:

```bash
cd aiml/
python3 test_all_endpoints.py
```

Covers all 14 endpoints and prints ✓/✗ per assertion.

---

## For the Spring Boot Backend Team

### Base URL
```
http://localhost:8000   (dev)
```
Set via Docker Compose service name in production (e.g. `http://aiml:8000`).

### Recommended call sequence
```
1. POST /extract-protocol-pdf    ← PDF file upload → extract criteria (multipart/form-data)
   POST /extract-protocol        ← raw text alternative
2. POST /screen-cohort           ← TIER 1: bulk screen the WHOLE cohort (cheap, ~2-3s for 222)
3. POST /orchestrate             ← TIER 2: full pipeline for ONE patient on drill-in
4. POST /hitl-review             ← when clinician acts on an escalation (needs audit_id from step 3)
5. GET  /adherence-overlay       ← pull missed_visits + travel_distance_km for risk features
6. GET  /audit-trail             ← for compliance dashboard polling
```

### Two-tier screening — do NOT loop /orchestrate
- **`POST /screen-cohort`** screens the entire cohort in ONE call: rule eligibility + XGBoost risk,
  **no Groq, no per-patient audit**. Returns a ranked lightweight list
  (`{patient_id, name, decision, confidence, risk_score, risk_level}`), ELIGIBLE first then by
  descending risk. ~2.3s for 222 patients. **Use this for the screening dashboard.**
- **`POST /orchestrate`** is the full per-patient pipeline (evidence + SHAP + escalation + Groq +
  audit) — **use only when a clinician opens one patient.** Looping it across a cohort is minutes-slow
  (Groq per patient); `/screen-cohort` is what avoids that.

`/screen-cohort` request:
```json
{
  "criteria": { "inclusion": ["Age 18-75","HbA1c 6.5-9.0"], "exclusion": ["Kidney disease"] },
  "patients": [
    { "patient_id": "42", "name": "Anibal T.",
      "patient": { "age": 62, "gender": "female", "hba1c": 7.2, "kidney_disease": false },
      "patient_features": { "age": 62, "missed_visits": 4, "travel_distance_km": 65.0, "...": "11 features" } }
  ]
}
```

### On `risk_unavailable: true`
If the model hasn't been trained yet, `/orchestrate` returns `"risk_unavailable": true` with `risk_score: null` and `risk_level: null` — **do not treat this as an error**. Show a "Model training pending" badge in the UI.

### CORS
All origins allowed in dev (`"*"`). Restrict in production by editing `app.py` `allow_origins`.

### Error codes
| Code | Meaning |
|------|---------|
| `200` | Success |
| `422` | Validation error or model not trained (body has `"error"` key) |
| `503` | Groq API unreachable (LLM endpoints only) |
| `500` | Unexpected server error |

---

## For the Frontend Team

### Key data flows for your dashboards

**Screening shortlist**
- Call `POST /orchestrate` per patient
- Render `screening_decision` + `screening_evidence[]` in the evidence panel (Accordion)
- `screening_confidence` → confidence badge

**Risk dashboard**
- `risk_score` (0–1 float) → progress bar
- `risk_level` → colour chip (LOW=green, MEDIUM=amber, HIGH=red)
- `risk_top_factors[]` → driver bar chart (Recharts BarChart, `feature` on Y, `impact` on X)

**Escalation / HITL panel**
- Show the HITL review UI only when `escalation.escalated === true`
- Display `escalation.reason`, `escalation.severity`, `escalation.recommended_action`
- On clinician action → `POST /hitl-review` with the `audit_id` from orchestration
- Three buttons: **Approve** · **Override** (require text input) · **Escalate**

**Compliance / Audit trail**
- `GET /audit-trail` — poll every 30s or on user action
- `chain_valid` → show a green "🔒 Tamper-evident" badge (or red alert if false)
- Render entries as a timestamped feed; highlight `ESCALATION` and `HITL_*` rows
- Filter controls → pass `action_filter` and `patient_id_filter` as query params

**Consent output mock**
- `POST /consent-summary` with the raw PDF text → display `summary` in a styled card
- `word_count` badge on the card

**Diversity panel**
- `POST /fairness-audit` with your screened cohort
- `gender_distribution` + `age_distribution` → Recharts PieChart or BarChart
- `warnings[]` → amber alert chips
- `recommendations[]` → info cards

---

## Contract — Agent Response Shape

Every agent response follows the shared contract agreed on Day 1:

```typescript
{
  decision:     string;          // "ELIGIBLE" | "INELIGIBLE" | "REQUIRES_REVIEW"
  evidence:     string[];        // human-readable justifications
  source_refs:  string[];        // dot-path patient field references
  confidence:   number;          // 0.0–1.0
}
```

`/orchestrate` wraps all agents and includes this for the screening step.

---

## Audit Trail — Tamper Evidence (Talking Point for Judges)

Each audit entry contains:
- Its own **SHA-256 hash** (computed over all fields except `hash` itself)
- The **previous entry's hash** (`prev_hash`)

`GET /audit-trail` returns `chain_valid: true` after verifying the entire chain in O(n). Any modification to a historical record breaks the chain immediately — verifiable in real time. This is the compliance-grade audit trail.

---

## File outputs (consumed by frontend/backend)

| File | Produced by | Content |
|------|-------------|---------|
| `data/audit_trail.json` | Auto (live) | Hash-chained audit log |
| `data/adherence_overlay.json` | `adherence/adherence_overlay.py` | Per-patient adherence + alerts |
| `models/risk_model.pkl` | `prediction/train.py` | Trained XGBoost model |
| `models/preprocessor.pkl` | `prediction/train.py` | Sklearn preprocessor |
| `models/feature_names.pkl` | `prediction/train.py` | Feature column list |
