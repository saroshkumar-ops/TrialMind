# Synthea → Postgres Field Mapping (the data contract)

This is the contract between the **data side** (Synthea generation, owned by the data person)
and the **Java side** (JPA entities + HAPI FHIR ingest loader, owned by the backend person).

> Build your `@Entity` classes and the ingest loader to match the tables below.
> Everything downstream (screening, risk, diversity, audit) queries *these* tables — not raw FHIR.

---

## 0. The data (already generated)

- **Source:** `data/seed/fhir/*.json` — 62 synthetic patients, FHIR R4 transaction bundles.
- **Reproducible:** `./run_synthea -s 7 -p 60 Massachusetts` (seed 7) regenerates the identical cohort.
- **Config used** (in `data/synthea/src/main/resources/synthea.properties`):
  - `exporter.years_of_history = 3`
  - `exporter.fhir.use_us_core_ig = false`
  - `exporter.fhir.included_resources = Patient,Condition,Observation,Encounter,MedicationRequest`
  - (This is why each bundle is ~150–550 KB instead of ~5 MB.)

Each bundle = one `Bundle` with `entry[].resource`. One `Patient` + many `Condition`,
`Observation`, `Encounter`, `MedicationRequest`. Resources reference the patient via
`subject.reference = "urn:uuid:<patientId>"`.

**Loader rule:** the patient UUID is the join key. Strip the `urn:uuid:` prefix from every
`subject.reference` / `encounter.reference` to get the foreign key.

---

## 1. `patient`  ← FHIR `Patient`

| Column | Type | FHIR path | Notes |
|---|---|---|---|
| `id` (PK) | UUID/String | `Patient.id` | also the join key for all child rows |
| `first_name` | String | `Patient.name[0].given[0]` | strip trailing digits if you want it pretty (`Anibal473`→`Anibal`) |
| `last_name` | String | `Patient.name[0].family` | |
| `gender` | String | `Patient.gender` | `male` / `female` |
| `birth_date` | Date | `Patient.birthDate` | derive `age` at query time |
| `marital_status` | String | `Patient.maritalStatus.text` | nullable |
| `city` | String | `Patient.address[0].city` | |
| `state` | String | `Patient.address[0].state` | |
| `race` | String | `Patient.extension[url=…us-core-race].extension[url=text].valueString` | see note ↓ |
| `ethnicity` | String | `Patient.extension[url=…us-core-ethnicity].extension[url=text].valueString` | see note ↓ |

> **Race/ethnicity note:** they live in nested `extension` blocks. URLs contain
> `us-core-race` / `us-core-ethnicity`; the human label is the inner extension with
> `url == "text"` → `valueString`. These two columns feed the **Diversity panel** — don't skip them.
> `age`, `gender`, `race`, `ethnicity` are the demographic axes for fairness flagging.

---

## 2. `condition`  ← FHIR `Condition`  (diagnoses / findings)

| Column | Type | FHIR path | Notes |
|---|---|---|---|
| `id` (PK) | UUID/String | `Condition.id` | |
| `patient_id` (FK) | UUID/String | `Condition.subject.reference` | strip `urn:uuid:` |
| `code` | String | `Condition.code.coding[0].code` | SNOMED code |
| `display` | String | `Condition.code.text` | e.g. `Diabetes mellitus type 2 (disorder)` |
| `clinical_status` | String | `Condition.clinicalStatus.coding[0].code` | `active` / `resolved` |
| `onset_date` | DateTime | `Condition.onsetDateTime` | nullable |

> Conditions drive **inclusion/exclusion matching** (screening) and **comorbidity features** (risk).
> Synthea mixes real diseases with social "findings" (`Stress`, `Full-time employment`). For
> screening, match on the clinical ones — see the demo protocol in §6.

---

## 3. `observation`  ← FHIR `Observation`  (labs + vitals)

| Column | Type | FHIR path | Notes |
|---|---|---|---|
| `id` (PK) | UUID/String | `Observation.id` | |
| `patient_id` (FK) | UUID/String | `Observation.subject.reference` | strip `urn:uuid:` |
| `category` | String | `Observation.category[0].coding[0].code` | `laboratory` / `vital-signs` |
| `code` | String | `Observation.code.coding[0].code` | **LOINC** code |
| `display` | String | `Observation.code.text` | e.g. `Hemoglobin A1c/Hemoglobin.total in Blood` |
| `value` | Double | `Observation.valueQuantity.value` | nullable (see ↓) |
| `unit` | String | `Observation.valueQuantity.unit` | e.g. `mg/dL`, `%` |
| `effective_date` | DateTime | `Observation.effectiveDateTime` | the timestamp — **keep it**, it powers trends + evidence citations |

> **Two gotchas:**
> 1. Not every Observation has `valueQuantity` — some are panels (e.g. *"Blood pressure panel"*)
>    with nested `component[]` (systolic/diastolic each have their own `valueQuantity`), and some
>    use `valueCodeableConcept` instead. For the demo: store the scalar `valueQuantity` ones; if you
>    need BP, read `component[].valueQuantity` (LOINC 8480-6 systolic, 8462-4 diastolic).
> 2. A patient has **many** readings of the same code over time → that's the time series the
>    **Data Analysis agent** uses for trend/biomarker detection. Don't dedupe.

**Key LOINC codes you'll actually query:**

| Lab/vital | LOINC | unit |
|---|---|---|
| HbA1c | `4548-4` | % |
| Glucose (blood) | `2339-0` | mg/dL |
| Body weight | `29463-7` | kg |
| BMI | `39156-5` | kg/m² |
| Body height | `8302-2` | cm |
| Heart rate | `8867-4` | /min |
| Systolic BP | `8480-6` | mmHg |
| Diastolic BP | `8462-4` | mmHg |
| Creatinine | `2160-0` | mg/dL |

---

## 4. `encounter`  ← FHIR `Encounter`  (visits)

| Column | Type | FHIR path | Notes |
|---|---|---|---|
| `id` (PK) | UUID/String | `Encounter.id` | |
| `patient_id` (FK) | UUID/String | `Encounter.subject.reference` | strip `urn:uuid:` |
| `class` | String | `Encounter.class.code` | `AMB` (ambulatory), `EMER`, etc. |
| `type_display` | String | `Encounter.type[0].text` | e.g. `Well child visit` |
| `start` | DateTime | `Encounter.period.start` | |
| `end` | DateTime | `Encounter.period.end` | |

> Encounters give **visit frequency / gaps** → a dropout-risk feature, and the base timeline the
> synthetic **adherence overlay** attaches to (see §5).

---

## 5. `medication_request`  ← FHIR `MedicationRequest`

| Column | Type | FHIR path | Notes |
|---|---|---|---|
| `id` (PK) | UUID/String | `MedicationRequest.id` | |
| `patient_id` (FK) | UUID/String | `MedicationRequest.subject.reference` | strip `urn:uuid:` |
| `medication` | String | `MedicationRequest.medicationCodeableConcept.text` | e.g. `Simvastatin 10 MG Oral Tablet` |
| `code` | String | `…medicationCodeableConcept.coding[0].code` | RxNorm code |
| `status` | String | `MedicationRequest.status` | `active` / `completed` / `stopped` |
| `authored_on` | DateTime | `MedicationRequest.authoredOn` | |
| `freq_per_period` | Int | `dosageInstruction[0].timing.repeat.frequency` | nullable |
| `period_unit` | String | `dosageInstruction[0].timing.repeat.periodUnit` | e.g. `d` (daily) |

---

## 6. Demo protocol this cohort supports (use this for screening)

**"Type 2 Diabetes management trial"** — chosen because the cohort actually has matches *and*
rejections (good for the demo):

- **Inclusion:** age 18–75 **AND** (`Diabetes mellitus type 2` OR `Prediabetes`) **AND** HbA1c 6.5–9.0%
- **Exclusion:** `Disorder of kidney due to diabetes mellitus` (renal complication) OR HbA1c > 9.0%

Cohort coverage (of 62): T2DM 4, Prediabetes 23, Obesity 32, Hypertension 17, diabetic-kidney 7,
HbA1c records 139. So screening will produce a believable ranked shortlist with cited evidence
(*"HbA1c = 7.2% on 2023-06-08 → meets inclusion criterion 2"*).

---

## 7. ⚠️ What Synthea does NOT give — synthesize on top (data side, Python)

Synthea models clinical history, **not a clinical trial.** These two are owned by the data/ML side
and do **not** belong in the FHIR ingest:

1. **Adherence / missed visits** — Synthea patients never no-show. Overlay a synthetic per-patient
   trial schedule (visits + doses) and inject misses/delays so the Adherence agent has something to flag.
2. **Dropout labels** — Synthea has no dropout label. Engineer one (heuristic: long encounter gaps +
   high comorbidity count + distance) to train the XGBoost risk model. Be ready to say this is
   synthetic-for-demo if a judge asks.

These live in the standalone `aiml/` FastAPI service and read `data/seed/fhir/` (or a CSV export)
directly — no dependency on the Java backend.
```
