"""
adherence/adherence_overlay.py
------------------------------
Synthetic trial-adherence overlay.

Synthea models clinical history but NOT a clinical trial — its patients never
miss a scheduled trial visit or a dose. This module overlays a synthetic trial
timeline on top of the real Synthea cohort:

  1. Enrols a cohort (patients whose conditions match the diabetes demo protocol).
  2. Gives each a visit schedule (every 28 days) + a daily study-drug dose.
  3. Simulates attendance + dosing, where adherence propensity is derived from the
     SAME real/engineered features used by the risk model (missed_visits,
     travel_distance, comorbidity) so the story is internally consistent.
  4. Computes per-patient adherence metrics and raises protocol-deviation alerts.

Output → aiml/data/adherence_overlay.json  (consumed by the Adherence agent /
compliance-alerts dashboard).

Honest caveat for judges: adherence + dosing are synthetically simulated for the
demo; in production this comes from real trial visit/eDiary data.

Usage:
    python adherence/adherence_overlay.py
"""

from __future__ import annotations

import glob
import json
import random
from datetime import date, datetime, timedelta
from pathlib import Path

# Reuse the exact feature extraction used for the risk model (keeps stories consistent)
import sys
_AIML_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_AIML_DIR))
from prediction.build_dataset import _features_for_patient  # noqa: E402

_SEED_DIR = _AIML_DIR.parent / "data" / "seed" / "fhir"
_OUT = _AIML_DIR / "data" / "adherence_overlay.json"

RNG_SEED = 7
random.seed(RNG_SEED)

# --- Trial design (all dates in the past relative to "today" so it's reviewable) ---
TRIAL_NAME = "Type 2 Diabetes Management Trial"
TRIAL_START = date(2025, 12, 1)
VISIT_INTERVAL_DAYS = 28
NUM_VISITS = 6
DAYS_BETWEEN_VISITS = VISIT_INTERVAL_DAYS
TOTAL_TRIAL_DAYS = VISIT_INTERVAL_DAYS * (NUM_VISITS - 1)  # daily dosing window
MAX_COHORT = 50  # keep the demo cohort focused

# Conditions that qualify a patient for the diabetes trial
ELIGIBLE_KEYWORDS = ["diabetes", "prediabetes", "obesity"]


def _condition_displays(bundle: dict) -> list[str]:
    return [
        e["resource"].get("code", {}).get("text", "").lower()
        for e in bundle.get("entry", [])
        if e["resource"]["resourceType"] == "Condition"
    ]


def _patient_identity(bundle: dict) -> tuple[str, str]:
    p = next(
        e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Patient"
    )
    name = p.get("name", [{}])[0]
    full = f"{(name.get('given') or [''])[0]} {name.get('family', '')}".strip()
    return p["id"], full


def _adherence_propensity(feats: dict) -> float:
    """
    Probability (0..1) a given visit/dose is honoured.
    Centred high (good adherence is the trial norm) with a tail of strugglers,
    nudged down by comorbidity burden and travel distance. Produces a realistic
    mix of on_track / at_risk / non_compliant rather than all-or-nothing.
    """
    p = (
        0.93
        + random.gauss(0, 0.05)
        - 0.035 * feats["has_comorbidity"]
        - 0.0008 * feats["travel_distance_km"]
    )
    # ~18% of patients are clear low-adherers (creates non_compliant cases)
    if random.random() < 0.18:
        p -= random.uniform(0.15, 0.30)
    return max(0.50, min(0.99, p))


def _simulate_patient(bundle: dict) -> dict | None:
    feats = _features_for_patient(bundle)
    if feats is None:
        return None
    pid, name = _patient_identity(bundle)
    propensity = _adherence_propensity(feats)

    # --- Visits ---
    visits = []
    attended = missed = late = 0
    for i in range(NUM_VISITS):
        scheduled = TRIAL_START + timedelta(days=i * DAYS_BETWEEN_VISITS)
        roll = random.random()
        if roll < propensity:
            status, actual = "attended", scheduled
            attended += 1
        elif roll < propensity + 0.12:  # showed up, but a few days late
            delay = random.randint(2, 7)
            status, actual = "late", scheduled + timedelta(days=delay)
            attended += 1
            late += 1
        else:
            status, actual = "missed", None
            missed += 1
        visits.append({
            "index": i + 1,
            "scheduled": scheduled.isoformat(),
            "status": status,
            "actual": actual.isoformat() if actual else None,
        })

    # --- Daily dosing ---
    expected_doses = TOTAL_TRIAL_DAYS
    taken = 0
    max_consecutive_missed = consecutive = 0
    for _ in range(expected_doses):
        if random.random() < propensity:
            taken += 1
            consecutive = 0
        else:
            consecutive += 1
            max_consecutive_missed = max(max_consecutive_missed, consecutive)
    adherence_rate = round(taken / expected_doses, 3)

    # --- Status bucket ---
    if adherence_rate >= 0.90 and missed == 0:
        status = "on_track"
    elif adherence_rate >= 0.75 and missed <= 1:
        status = "at_risk"
    else:
        status = "non_compliant"

    # --- Protocol-deviation flags ---
    deviations = []
    for v in visits:
        if v["status"] == "missed":
            deviations.append(f"Missed visit {v['index']} (scheduled {v['scheduled']}) — no-show")
        elif v["status"] == "late":
            deviations.append(f"Visit {v['index']} attended late ({v['actual']})")
    if adherence_rate < 0.80:
        deviations.append(f"Medication adherence {adherence_rate:.0%} below 80% protocol threshold")
    if max_consecutive_missed >= 4:
        deviations.append(f"{max_consecutive_missed} consecutive missed doses — adherence gap")

    return {
        "patient_id": pid,
        "name": name,
        "adherence_status": status,
        "visits_scheduled": NUM_VISITS,
        "visits_attended": attended,
        "visits_missed": missed,
        "visits_late": late,
        "doses_expected": expected_doses,
        "doses_taken": taken,
        "adherence_rate": adherence_rate,
        "max_consecutive_missed_doses": max_consecutive_missed,
        "visits": visits,
        "deviations": deviations,
    }


def _severity(patient: dict) -> str:
    if patient["adherence_status"] == "non_compliant":
        return "high"
    if patient["adherence_status"] == "at_risk":
        return "medium"
    return "low"


def main():
    files = sorted(glob.glob(str(_SEED_DIR / "*.json")))
    if not files:
        raise SystemExit(f"No FHIR bundles in {_SEED_DIR}")

    cohort = []
    for fp in files:
        with open(fp, encoding="utf-8") as fh:
            bundle = json.load(fh)
        if not any(k in d for d in _condition_displays(bundle) for k in ELIGIBLE_KEYWORDS):
            continue
        sim = _simulate_patient(bundle)
        if sim:
            cohort.append(sim)
        if len(cohort) >= MAX_COHORT:
            break

    # Flattened alert feed (only patients with deviations), high severity first
    alerts = []
    for p in cohort:
        for d in p["deviations"]:
            alerts.append({
                "patient_id": p["patient_id"],
                "name": p["name"],
                "severity": _severity(p),
                "detail": d,
            })
    alerts.sort(key=lambda a: {"high": 0, "medium": 1, "low": 2}[a["severity"]])

    summary = {
        "on_track": sum(1 for p in cohort if p["adherence_status"] == "on_track"),
        "at_risk": sum(1 for p in cohort if p["adherence_status"] == "at_risk"),
        "non_compliant": sum(1 for p in cohort if p["adherence_status"] == "non_compliant"),
    }

    output = {
        "trial": {
            "name": TRIAL_NAME,
            "start_date": TRIAL_START.isoformat(),
            "visit_interval_days": VISIT_INTERVAL_DAYS,
            "num_visits": NUM_VISITS,
            "dosing": "daily",
        },
        "cohort_size": len(cohort),
        "summary": summary,
        "patients": cohort,
        "alerts": alerts,
    }

    _OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(_OUT, "w", encoding="utf-8") as fh:
        json.dump(output, fh, indent=2)

    print(f"Adherence overlay built: {len(cohort)} enrolled patients → {_OUT}")
    print(f"Status breakdown: {summary}")
    print(f"Total deviation alerts: {len(alerts)}")
    if alerts:
        print("\nSample high-severity alerts:")
        for a in [x for x in alerts if x["severity"] == "high"][:5]:
            print(f"  [{a['severity'].upper()}] {a['name']}: {a['detail']}")


if __name__ == "__main__":
    main()
