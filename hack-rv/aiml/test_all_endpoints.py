#!/usr/bin/env python3
"""
test_all_endpoints.py
---------------------
Smoke-tests every TrialMind AIML endpoint.
Run with the server up:  python3 test_all_endpoints.py

Exits 0 if all pass, 1 if any fail.
"""

import json
import sys
import time
import httpx

BASE = "http://127.0.0.1:8000"

# ---------------------------------------------------------------------------
# Pre-flight: make sure the server is actually up before running any tests
# ---------------------------------------------------------------------------
def _server_is_up() -> bool:
    try:
        httpx.get(f"{BASE}/health", timeout=3)
        return True
    except Exception:
        return False

if not _server_is_up():
    print("\n\033[91m✗  Server is NOT running on http://127.0.0.1:8000\033[0m")
    print("\nStart it first in another terminal:\n")
    print("    cd /home/akenzz/Projects/rv/aiml")
    print("    .venv/bin/uvicorn app:app --reload --port 8000\n")
    print("Then re-run:  python3 test_all_endpoints.py\n")
    sys.exit(1)

BASE = "http://127.0.0.1:8000"
PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"

results = []

def check(name: str, ok: bool, detail: str = ""):
    status = PASS if ok else FAIL
    print(f"  {status}  {name}" + (f"  →  {detail}" if detail else ""))
    results.append(ok)

def post(path, body):
    return httpx.post(f"{BASE}{path}", json=body, timeout=30)

def get(path, params=None):
    return httpx.get(f"{BASE}{path}", params=params, timeout=10)


print("\n=== TrialMind AIML Endpoint Smoke Tests ===\n")

# ── Infrastructure ────────────────────────────────────────────────────────────
print("[ Infrastructure ]")
r = get("/health")
check("/health status=200", r.status_code == 200)
data = r.json()
check("/health returns 'ok'", data.get("status") == "ok", str(data.get("status")))
check("/health groq_configured present", "groq_configured" in data)

r = get("/model-info")
check("/model-info status=200", r.status_code == 200)
data = r.json()
check("/model-info returns status field", "status" in data, data.get("status"))

# ── Protocol Extraction ───────────────────────────────────────────────────────
print("\n[ Protocol ]")
PROTOCOL_TEXT = (
    "Inclusion Criteria:\n"
    "- Age 18 to 65 years\n"
    "- HbA1c between 6.5 and 9.0\n"
    "- Type 2 diabetes diagnosis\n\n"
    "Exclusion Criteria:\n"
    "- Kidney disease or renal impairment\n"
    "- Pregnancy\n"
    "- History of stroke\n"
)
r = post("/extract-protocol", {"protocol_text": PROTOCOL_TEXT})
check("/extract-protocol status=200", r.status_code == 200)
data = r.json()
check("/extract-protocol returns inclusion list", isinstance(data.get("inclusion"), list),
      f"got {len(data.get('inclusion', []))} criteria")
check("/extract-protocol returns exclusion list", isinstance(data.get("exclusion"), list),
      f"got {len(data.get('exclusion', []))} criteria")
check("/extract-protocol returns confidence", isinstance(data.get("confidence"), float),
      str(data.get("confidence")))

CRITERIA = {"inclusion": data.get("inclusion", []), "exclusion": data.get("exclusion", [])}

# ── Screening ─────────────────────────────────────────────────────────────────
print("\n[ Screening ]")
PATIENT = {"age": 45, "hba1c": 7.2, "kidney_disease": False, "gender": "female"}
r = post("/screen-patient", {
    "criteria": {"inclusion": CRITERIA["inclusion"][:2] or ["Age 18-65", "HbA1c 6.5-9.0"],
                 "exclusion": CRITERIA["exclusion"][:1] or ["Kidney disease"]},
    "patient": PATIENT,
})
check("/screen-patient status=200", r.status_code == 200)
data = r.json()
check("/screen-patient returns decision", data.get("decision") in ("ELIGIBLE", "INELIGIBLE", "REQUIRES_REVIEW"),
      data.get("decision"))
check("/screen-patient returns evidence list", isinstance(data.get("evidence"), list),
      f"{len(data.get('evidence', []))} items")
check("/screen-patient returns confidence", isinstance(data.get("confidence"), float))

# ── Risk Prediction ───────────────────────────────────────────────────────────
print("\n[ Risk Prediction ]")
FEATURES = {"age": 45, "missed_visits": 2, "travel_distance_km": 60.0, "has_comorbidity": 0}
r = post("/predict-risk", {"patient_features": FEATURES})
check("/predict-risk status 200 or 422", r.status_code in (200, 422))
if r.status_code == 200:
    data = r.json()
    check("/predict-risk returns risk_score", isinstance(data.get("risk_score"), float), str(data.get("risk_score")))
    check("/predict-risk returns risk_level", data.get("risk_level") in ("LOW", "MEDIUM", "HIGH"))
else:
    check("/predict-risk graceful 422 (model not trained)", r.status_code == 422, "model not yet trained — expected")

# ── Fairness Audit ────────────────────────────────────────────────────────────
print("\n[ Fairness ]")
COHORT = [
    {"age": 35, "gender": "male"},
    {"age": 52, "gender": "female"},
    {"age": 68, "gender": "female"},
    {"age": 29, "gender": "male"},
    {"age": 45, "gender": "non-binary"},
]
r = post("/fairness-audit", {"patients": COHORT})
check("/fairness-audit status=200", r.status_code == 200)
data = r.json()
check("/fairness-audit total_patients correct", data.get("total_patients") == 5)
check("/fairness-audit gender_distribution present", isinstance(data.get("gender_distribution"), dict))
check("/fairness-audit age_distribution present", isinstance(data.get("age_distribution"), dict))

# ── Eligibility Explanation ───────────────────────────────────────────────────
print("\n[ Explanation ]")
r = post("/explain-eligibility", {
    "criteria": {"inclusion": ["Age 18-65", "HbA1c 6.5-9.0"], "exclusion": ["Kidney disease"]},
    "patient": PATIENT,
    "decision": "ELIGIBLE",
})
check("/explain-eligibility status=200", r.status_code == 200)
data = r.json()
check("/explain-eligibility returns explanation", isinstance(data.get("explanation"), str) and len(data["explanation"]) > 10,
      f"generated_by={data.get('generated_by')}")

r = post("/consent-summary", {"protocol_text": PROTOCOL_TEXT})
check("/consent-summary status=200", r.status_code == 200)
data = r.json()
check("/consent-summary returns summary", isinstance(data.get("summary"), str) and len(data["summary"]) > 10)
check("/consent-summary returns word_count", isinstance(data.get("word_count"), int))

# ── Orchestration ─────────────────────────────────────────────────────────────
print("\n[ Orchestration ]")
r = post("/orchestrate", {
    "protocol_text": PROTOCOL_TEXT,
    "patient": PATIENT,
    "patient_features": FEATURES,
    "adherence_record": {"adherence_status": "non_compliant", "adherence_rate": 0.62},
    "patient_id": "smoke-test-patient-001",
    "actor": "smoke_test",
    "include_explanation": True,
})
check("/orchestrate status=200", r.status_code == 200)
data = r.json()
check("/orchestrate returns criteria", isinstance(data.get("criteria"), dict))
check("/orchestrate returns screening_decision",
      data.get("screening_decision") in ("ELIGIBLE", "INELIGIBLE", "REQUIRES_REVIEW"),
      data.get("screening_decision"))
check("/orchestrate returns escalation block", isinstance(data.get("escalation"), dict),
      f"escalated={data.get('escalation', {}).get('escalated')}")
check("/orchestrate returns audit_id", isinstance(data.get("audit_id"), str) and len(data["audit_id"]) == 36,
      data.get("audit_id", "")[:8] + "...")

AUDIT_ID = data.get("audit_id", "missing")

# ── HITL Review ───────────────────────────────────────────────────────────────
print("\n[ HITL ]")
r = post("/hitl-review", {
    "audit_id": AUDIT_ID,
    "action": "APPROVE",
    "actor": "dr.test",
    "patient_id": "smoke-test-patient-001",
    "notes": "Smoke test approval",
})
check("/hitl-review APPROVE status=200", r.status_code == 200)
data = r.json()
check("/hitl-review returns review_audit_id", isinstance(data.get("review_audit_id"), str))
check("/hitl-review references correct audit_id", data.get("references_audit_id") == AUDIT_ID)

r = post("/hitl-review", {
    "audit_id": AUDIT_ID,
    "action": "OVERRIDE",
    "actor": "dr.test",
    "patient_id": "smoke-test-patient-001",
    "override_reason": "Patient meets criteria on manual chart review.",
})
check("/hitl-review OVERRIDE status=200", r.status_code == 200)

# OVERRIDE without reason should 422
r = post("/hitl-review", {
    "audit_id": AUDIT_ID,
    "action": "OVERRIDE",
    "actor": "dr.test",
    "patient_id": "smoke-test-patient-001",
})
check("/hitl-review OVERRIDE without reason → 422", r.status_code == 422)

# ── Audit Trail ───────────────────────────────────────────────────────────────
print("\n[ Audit Trail ]")
r = get("/audit-trail")
check("/audit-trail status=200", r.status_code == 200)
data = r.json()
check("/audit-trail chain_valid=True", data.get("chain_valid") is True, data.get("chain_message"))
check("/audit-trail has entries from this run", data.get("total_entries", 0) >= 3)

r = get("/audit-trail", params={"action_filter": "ORCHESTRATION"})
check("/audit-trail ?action_filter=ORCHESTRATION works",
      r.status_code == 200 and all(e["action"] == "ORCHESTRATION" for e in r.json().get("entries", [])),
      f"{r.json().get('total_entries')} entries")

r = get("/audit-trail", params={"patient_id_filter": "smoke-test-patient-001"})
check("/audit-trail ?patient_id_filter works",
      r.status_code == 200 and r.json().get("total_entries", 0) > 0)

# ── Biomarker Spike / Data Agent ──────────────────────────────────────────────
print("\n[ Data Agent — /analyze-data ]")

# Case 1: spike expected (HbA1c jumps >20% from baseline)
r = post("/analyze-data", {
    "patient_id": "smoke-test-patient-001",
    "biomarker": "hba1c",
    "observations": [
        {"date": "2025-01-01", "value": 6.5},
        {"date": "2025-02-01", "value": 6.7},
        {"date": "2025-03-01", "value": 6.6},
        {"date": "2025-04-01", "value": 8.2},   # spike ~25%
        {"date": "2025-05-01", "value": 9.1},
    ],
    "spike_threshold_pct": 20.0,
})
check("/analyze-data status=200", r.status_code == 200)
data = r.json()
check("/analyze-data spike detected", data.get("biomarker_spike") is True,
      f"magnitude={data.get('spike_magnitude_pct')}%")
check("/analyze-data trend=rising", data.get("trend") == "rising")
check("/analyze-data detail is non-empty", isinstance(data.get("detail"), str) and len(data["detail"]) > 10)

# Case 2: no spike (stable values)
r = post("/analyze-data", {
    "patient_id": "smoke-test-patient-002",
    "biomarker": "glucose",
    "observations": [
        {"date": "2025-01-01", "value": 110.0},
        {"date": "2025-02-01", "value": 112.0},
        {"date": "2025-03-01", "value": 108.0},
        {"date": "2025-04-01", "value": 111.0},
    ],
    "spike_threshold_pct": 20.0,
})
check("/analyze-data no spike (stable)", r.status_code == 200 and r.json().get("biomarker_spike") is False,
      f"trend={r.json().get('trend')}")

# Case 3: insufficient data → graceful response
r = post("/analyze-data", {
    "patient_id": "smoke-test-patient-003",
    "biomarker": "bmi",
    "observations": [{"date": "2025-01-01", "value": 28.5}],
})
check("/analyze-data single obs → insufficient_data", r.status_code == 200 and r.json().get("trend") == "insufficient_data")

# ── Adherence Overlay ─────────────────────────────────────────────────────────
print("\n[ Adherence — /adherence-overlay ]")
r = get("/adherence-overlay")
if r.status_code == 404:
    check("/adherence-overlay 404 (overlay not generated yet — run adherence_overlay.py)", True,
          "expected if overlay JSON not generated")
else:
    check("/adherence-overlay status=200", r.status_code == 200)
    data = r.json()
    check("/adherence-overlay has patients list", isinstance(data.get("patients"), list),
          f"{len(data.get('patients', []))} patients")
    check("/adherence-overlay has summary", isinstance(data.get("summary"), dict))
    check("/adherence-overlay has trial block", isinstance(data.get("trial"), dict))

    # Filter by status
    r2 = get("/adherence-overlay", params={"status_filter": "non_compliant"})
    check("/adherence-overlay ?status_filter=non_compliant works",
          r2.status_code == 200,
          f"{r2.json().get('filtered_count', '?')} patients")

    # Invalid filter → 400
    r3 = get("/adherence-overlay", params={"status_filter": "bad_value"})
    check("/adherence-overlay invalid status_filter → 400", r3.status_code == 400)

# ── /extract-protocol-pdf ────────────────────────────────────────────────────
print("\n[ Protocol PDF — /extract-protocol-pdf ]")
# We can't upload a real PDF file in a smoke test without a fixture file.
# Test the validation guard (non-PDF upload → 400).
import io as _io
r = httpx.post(
    f"{BASE}/extract-protocol-pdf",
    files={"file": ("test.txt", _io.BytesIO(b"not a pdf"), "text/plain")},
    timeout=10,
)
check("/extract-protocol-pdf non-PDF → 400", r.status_code == 400,
      "file type validation working")

# ── Summary ───────────────────────────────────────────────────────────────────
total = len(results)
passed = sum(results)
failed = total - passed

print(f"\n{'='*46}")
print(f"  {PASS} {passed}/{total} passed    {FAIL} {failed} failed")
print(f"{'='*46}\n")

sys.exit(0 if failed == 0 else 1)
