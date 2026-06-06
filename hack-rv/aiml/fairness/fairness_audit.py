"""
fairness/fairness_audit.py
---------------------------
Module 6 — Fairness Audit.

Analyses a patient cohort for demographic representation.
Generic implementation — works on any list of patient dicts.

Computes:
  - Gender distribution (counts + percentages)
  - Age group distribution (0–18, 18–40, 40–60, 60+)
  - Underrepresentation warnings (< 20% threshold)
  - Actionable recommendations

Uses flexible field detection: looks for common field name variants.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List

from schemas.patient_schema import FairnessAuditResponse
from utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
UNDERREPRESENTATION_THRESHOLD = 0.20  # < 20% is flagged

AGE_BUCKETS = [
    (0, 18, "0–18 (paediatric)"),
    (18, 40, "18–40 (young adult)"),
    (40, 60, "40–60 (middle-aged)"),
    (60, 200, "60+ (elderly)"),
]

GENDER_FIELD_VARIANTS = ["gender", "sex", "biological_sex", "patient_gender"]
AGE_FIELD_VARIANTS = ["age", "age_years", "patient_age", "age_at_enrollment"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_field(patient: Dict[str, Any], variants: List[str]) -> Any:
    """Search a patient dict for any of the given field name variants."""
    patient_lower = {k.lower().replace(" ", "_"): v for k, v in patient.items()}
    for v in variants:
        if v in patient_lower:
            return patient_lower[v]
    return None


def _normalise_gender(raw: Any) -> str:
    """Map raw gender values to canonical labels."""
    if raw is None:
        return "Unknown"
    s = str(raw).strip().lower()
    if s in {"m", "male", "man", "1"}:
        return "Male"
    if s in {"f", "female", "woman", "0"}:
        return "Female"
    if s in {"nb", "non-binary", "nonbinary", "non_binary", "x"}:
        return "Non-binary"
    return "Other/Unknown"


def _age_bucket(age: float) -> str:
    for lo, hi, label in AGE_BUCKETS:
        if lo <= age < hi:
            return label
    return "Unknown"


def _distribution_with_pct(counter: Counter, total: int) -> Dict[str, Any]:
    """Convert a Counter to a dict with counts and percentages."""
    return {
        label: {
            "count": count,
            "percentage": round(count / total * 100, 1) if total > 0 else 0.0,
        }
        for label, count in sorted(counter.items())
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def audit_fairness(patients: List[Dict[str, Any]]) -> FairnessAuditResponse:
    """
    Perform a fairness audit on a cohort of patients.

    Args:
        patients: List of patient dicts (arbitrary structure).

    Returns:
        FairnessAuditResponse with distributions, warnings, and recommendations.
    """
    total = len(patients)
    logger.info("Starting fairness audit for %d patients.", total)

    gender_counter: Counter = Counter()
    age_bucket_counter: Counter = Counter()
    ages: List[float] = []

    for patient in patients:
        # Gender
        raw_gender = _find_field(patient, GENDER_FIELD_VARIANTS)
        gender_counter[_normalise_gender(raw_gender)] += 1

        # Age
        raw_age = _find_field(patient, AGE_FIELD_VARIANTS)
        if raw_age is not None:
            try:
                age = float(raw_age)
                ages.append(age)
                age_bucket_counter[_age_bucket(age)] += 1
            except (ValueError, TypeError):
                age_bucket_counter["Unknown"] += 1
        else:
            age_bucket_counter["Unknown"] += 1

    # --- Warnings ---
    warnings: List[str] = []
    recommendations: List[str] = []

    # Gender warnings
    for label, count in gender_counter.items():
        pct = count / total if total > 0 else 0
        if pct < UNDERREPRESENTATION_THRESHOLD and label not in {"Other/Unknown", "Unknown"}:
            warnings.append(
                f"{label} participants may be underrepresented "
                f"({count}/{total} = {pct*100:.1f}%)."
            )
            recommendations.append(
                f"Consider actively recruiting more {label} participants to reach ≥20% representation."
            )

    unknown_gender = gender_counter.get("Other/Unknown", 0) + gender_counter.get("Unknown", 0)
    if unknown_gender > total * 0.1:
        warnings.append(
            f"Gender data is missing for {unknown_gender} patients ({unknown_gender/total*100:.1f}%). "
            "This limits fairness analysis reliability."
        )
        recommendations.append("Ensure gender is captured for all enrolled patients.")

    # Age warnings
    for label, count in age_bucket_counter.items():
        pct = count / total if total > 0 else 0
        if label == "0–18 (paediatric)" and count == 0 and total > 0:
            # Not always a warning — skip unless relevant
            pass
        elif pct < UNDERREPRESENTATION_THRESHOLD and label not in {"Unknown"}:
            warnings.append(
                f"Age group '{label}' may be underrepresented "
                f"({count}/{total} = {pct*100:.1f}%)."
            )

    if ages:
        mean_age = sum(ages) / len(ages)
        if mean_age > 55:
            recommendations.append(
                f"Mean patient age is {mean_age:.1f} — consider whether younger cohorts are adequately included."
            )
        elif mean_age < 30:
            recommendations.append(
                f"Mean patient age is {mean_age:.1f} — consider whether older cohorts are adequately included."
            )

    if not warnings:
        recommendations.append("Cohort appears reasonably balanced across audited demographic dimensions.")

    gender_dist = _distribution_with_pct(gender_counter, total)
    age_dist = _distribution_with_pct(age_bucket_counter, total)

    logger.info(
        "Fairness audit complete: %d warnings, %d recommendations",
        len(warnings),
        len(recommendations),
    )

    return FairnessAuditResponse(
        total_patients=total,
        gender_distribution=gender_dist,
        age_distribution=age_dist,
        warnings=warnings,
        recommendations=recommendations,
    )
