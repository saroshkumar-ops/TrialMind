# Backend Tasks — DEPRECATED (the Java backend was removed)

> **This document is obsolete.** The architecture changed: there is **no Java
> backend / Spring Boot / Postgres gateway anymore.** The `backend/` folder was
> deleted. The frontend now talks **directly to the Python AIML service**, and
> **Python owns the data layer** via SQLite.

## What replaced it
The Java responsibilities (data ingestion + feature assembly + gateway) were ported
into the Python service:

| Old Java piece | New Python replacement |
|---|---|
| `SyntheaDataLoader` (FHIR → Postgres) | [`aiml/data_layer/registry.py`](../aiml/data_layer/registry.py) `seed_cohort()` |
| `FeatureAssemblyService` (11 features) | `registry.feature_dict()` / `registry.screening_patient()` |
| `Patient` / `Trial` entities + Postgres | SQLite (`aiml/data_layer/db.py`) — `patients`, `trials` tables |
| Trial + criteria storage | [`aiml/data_layer/trial_store.py`](../aiml/data_layer/trial_store.py) |
| Gateway endpoints (`/api/...`) | New endpoints in `aiml/app.py` (trials, patients, screen-cohort, orchestrate) |
| Adherence ingestion | merged into the registry from `aiml/data/adherence_overlay.json` |

## Where to look now
- **The flow + every endpoint:** [end-to-end-flow.md](end-to-end-flow.md)
- **The frontend contract:** [frontend-workflow.md](frontend-workflow.md)
- **The plan:** [remaining-build-plan.md](remaining-build-plan.md)

The SQLite DB (`aiml/data/trialmind.db`) is generated on first startup from
`data/seed/fhir/*.json` — it is gitignored and rebuilds automatically.
