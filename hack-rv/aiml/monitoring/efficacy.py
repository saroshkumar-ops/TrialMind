"""
monitoring/efficacy.py
----------------------
Efficacy model — "is the treatment working?"

Interpretable trajectory analysis: compare a biomarker's observed change against
the protocol-expected trajectory, classify the response, and attribute it to
adherence + visit regularity (the drivers a clinician acts on).

For diabetes-trial biomarkers, LOWER is better (HbA1c, glucose, BMI, weight).
Expected monthly improvement is protocol-defined below.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from utils.logger import get_logger

logger = get_logger(__name__)

# Protocol-expected monthly change. Sign = expected direction of movement.
EXPECTED_MONTHLY = {
    "hba1c": -0.167,        # ~ -0.5% per 3 months
    "glucose": -5.0,        # ~ -15 mg/dL per 3 months
    "bmi": -0.167,
    "weight": -1.0,         # ~ -1 kg / month
    "systolic_bp": -4.0,    # ~ -12 mmHg per 3 months (HTN trial)
    "diastolic_bp": -2.5,
    "fev1": 1.5,            # FEV1 should RISE on treatment (COPD trial)
}

# Which direction counts as "improvement" for each biomarker.
IMPROVEMENT_DIRECTION = {"fev1": "higher"}  # everything else: lower is better

# Classification bands on "% of expected response achieved".
_ON_TRACK_LOW = 75.0
_ABOVE_HIGH = 130.0


def _months_between(d0: str, d1: str) -> float:
    a = datetime.strptime(d0[:10], "%Y-%m-%d")
    b = datetime.strptime(d1[:10], "%Y-%m-%d")
    return max((b - a).days / 30.44, 0.0)


def evaluate_efficacy(
    biomarker: str,
    series: List[Dict[str, Any]],
    adherence_rate: Optional[float] = None,
    visit_count: Optional[int] = None,
) -> Dict[str, Any]:
    """
    series: chronological [{"date":"YYYY-MM-DD","value":float}, ...] (>= 2 points).
    Returns trajectory classification + drivers + a plain-English message.
    """
    biomarker = biomarker.lower()
    if biomarker not in EXPECTED_MONTHLY:
        return {"status": "unsupported",
                "detail": f"Efficacy not defined for biomarker '{biomarker}'."}

    pts = sorted(
        [{"date": p["date"][:10], "value": float(p["value"])} for p in series if p.get("value") is not None],
        key=lambda p: p["date"],
    )
    if len(pts) < 2:
        return {"status": "insufficient_data", "n_points": len(pts),
                "detail": "Need at least 2 readings to assess treatment response."}

    baseline = pts[0]["value"]
    latest = pts[-1]["value"]
    months = _months_between(pts[0]["date"], pts[-1]["date"]) or 1.0

    observed_change = latest - baseline
    expected_change = EXPECTED_MONTHLY[biomarker] * months

    # Normalise to "response" where positive = improvement, regardless of direction.
    if IMPROVEMENT_DIRECTION.get(biomarker) == "higher":
        response = observed_change          # rising is good (e.g. FEV1)
        expected_response = expected_change
    else:
        response = -observed_change         # falling is good (HbA1c, BP, ...)
        expected_response = -expected_change
    pct_of_expected = (response / expected_response * 100.0) if expected_response else 0.0

    if pct_of_expected >= _ABOVE_HIGH:
        status = "above_expected"
    elif pct_of_expected >= _ON_TRACK_LOW:
        status = "on_track"
    else:
        status = "below_expected"

    # --- Driver attribution (interpretable, normalized) ---
    drivers: List[Dict[str, Any]] = []
    if adherence_rate is not None:
        # higher adherence → more positive contribution
        drivers.append({"factor": "medication_adherence",
                        "impact": round((adherence_rate - 0.5) * 2 * 0.6, 3)})
    if visit_count is not None:
        drivers.append({"factor": "visit_regularity",
                        "impact": round(min(visit_count / 6.0, 1.0) * 0.4 - 0.2, 3)})
    drivers.append({"factor": "biomarker_trend",
                    "impact": round(max(min(pct_of_expected / 100.0 - 0.5, 0.5), -0.5), 3)})
    drivers.sort(key=lambda d: abs(d["impact"]), reverse=True)

    arrow = "dropped" if observed_change < 0 else "rose"
    detail = (
        f"{biomarker.upper()} {arrow} {abs(observed_change):.2f} over {months:.1f} months "
        f"({pct_of_expected:.0f}% of the expected {abs(expected_change):.2f} reduction) — "
        f"{status.replace('_', ' ')}."
    )

    return {
        "status": status,
        "biomarker": biomarker,
        "baseline_value": round(baseline, 3),
        "latest_value": round(latest, 3),
        "observed_change": round(observed_change, 3),
        "expected_change": round(expected_change, 3),
        "pct_of_expected": round(pct_of_expected, 1),
        "months_elapsed": round(months, 2),
        "n_points": len(pts),
        "drivers": drivers,
        "detail": detail,
    }
