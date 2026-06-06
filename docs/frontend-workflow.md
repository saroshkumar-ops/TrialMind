# Frontend Workflow (Next.js) — no-Java architecture

> **The frontend calls the Python AIML service directly** (FastAPI, default
> `http://localhost:8000`). There is **no Java backend.** Set
> `NEXT_PUBLIC_AIML_URL` and point every API client at it.

Response shapes for every call are in [end-to-end-flow.md](end-to-end-flow.md) — write
your `types/*.ts` from those.

## Key mental model
> The screening table comes from **ONE cheap call** (`GET /trials/{id}/screen-cohort`,
> whole cohort in ~3s). Clicking a row fires **ONE rich call**
> (`POST /patients/{id}/orchestrate`) for that single patient. Everything else is
> read-only dashboards.

---

## Page-by-page (Phases 0–2 — build these first)

| # | Page | User action | Frontend → Python | Renders |
|---|------|-------------|-------------------|---------|
| 0 | `/protocol` | Drag in protocol PDF | `POST /trials/{id}/protocol` (multipart `file`) | extracted inclusion/exclusion **criteria chips** |
| 1 | `/recruit` | Fill enrollment form | `POST /patients` (json) | "Enrolled ✓" + auto-screen decision chip |
| 2 | `/screening` | Click "Screen cohort" | `GET /trials/{id}/screen-cohort` | **ranked table** (eligible-first): decision chip, confidence, risk-level colour chip |
| 2b| `/screening` → row click | Open a patient | `POST /patients/{id}/orchestrate` `{trial_id, actor}` | detail drawer: **evidence accordion**, **SHAP bar chart**, adherence status |
| 3 | `/review` (or drawer banner) | If `escalation.escalated` | `POST /hitl-review` | Approve / Override (needs text) / Escalate → "Recorded ✓" |

## Phase 3 — active monitoring (enrolled patients)

| # | Page | User action | Frontend → Python | Renders |
|---|------|-------------|-------------------|---------|
| M1| `/monitoring` → patient | Submit a visit reading | `POST /patients/{id}/visit` `{trial_id, visit_date, vitals}` | **monitoring status chip** (stable/watch/alert), safety detail, efficacy verdict, escalation banner |
| M2| `/monitoring` → patient | Open trajectory | `GET /patients/{id}/visits` | **vitals trajectory chart** + per-visit status |

Monitoring render notes (from `/patients/{id}/visit`):
- `monitoring_status` → chip (stable=green, watch=amber, alert=red)
- `safety.is_anomaly` + `safety.drivers[]` → "⚠ glucose 27σ above cohort" callout
- `efficacy.status` → on_track / above_expected / below_expected chip; `efficacy.pct_of_expected` → gauge
- `dropout.risk_level` → colour chip · `escalation.escalated` → same HITL banner (`audit_id` → `POST /hitl-review`)

## Supporting dashboards (Phase 2 breadth — build after the spine)

| # | Page | Frontend → Python | Renders |
|---|------|-------------------|---------|
| 4 | `/diversity` | `POST /fairness-audit` (`{patients:[...]}`) | demographic charts + warning chips |
| 5 | `/adherence` | `GET /adherence-overlay` | deviation alerts feed |
| 6 | `/audit` | `GET /audit-trail` | timestamped log + 🔒 `chain_valid` badge |
| 7 | `/dashboard` | aggregates the above | overview cards |

---

## Field-level render notes

**Screening table (Tier 1)** — from `/trials/{id}/screen-cohort` `results[]`:
- `decision` → chip (ELIGIBLE=green, REQUIRES_REVIEW=amber, INELIGIBLE=grey)
- `confidence` → % badge · `risk_level` → colour chip · `risk_score` → optional bar
- `risk_unavailable: true` → "model pending" instead of a score

**Patient drawer (Tier 2)** — from `/patients/{id}/orchestrate`:
- `screening_decision` + `screening_evidence[]` → header + "why?" accordion
- `risk_score` → progress bar; `risk_level` → colour chip
- `risk_top_factors[]` → Recharts BarChart (`feature` Y, `impact` X; +=red, −=green)
- `eligibility_explanation` → plain-English card
- `escalation.escalated === true` → escalation banner; keep `audit_id` for HITL

**HITL** → `POST /hitl-review` `{ audit_id, action, actor, override_reason? }`.
`action` ∈ `APPROVE | OVERRIDE | ESCALATE`; **OVERRIDE requires a reason field.**

**Patient list / registry** — `GET /patients` → `{ total, patients[] }`; each patient
has `patient_id, name, age, gender, hba1c, bmi, glucose, kidney_disease, source,
screening_decision`. Filter the recruitment registry with `?source=self-enroll`.

---

## Build order (most-unblocking first)
1. **`types/*.ts`** from [end-to-end-flow.md](end-to-end-flow.md) — the contract.
2. **`lib/api/*`** (axios, base URL = `NEXT_PUBLIC_AIML_URL`) + **`hooks/*`** (React Query).
3. **Screening table → patient drawer → HITL banner** — the demo spine, end to end.
4. Breadth: protocol upload → recruit form → diversity → adherence → audit → dashboard.
5. Polish: loading / empty / error states.

## Notes
- ⚠️ Next.js 16 has breaking changes — read `frontend/AGENTS.md` first.
- CORS on the FastAPI app is already `*`, so direct browser calls work in dev.
- Start the AIML service: `cd aiml && uvicorn app:app --reload --port 8000`. It seeds
  the SQLite DB (222 patients + default trial) on first boot — no manual setup.
- You can mock against the example JSON in [end-to-end-flow.md](end-to-end-flow.md) and
  swap to the live service once it's running. One real page beats five empty ones.
