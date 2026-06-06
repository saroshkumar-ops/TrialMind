"""
screening/screening_engine.py
------------------------------
Module 2 — Patient Eligibility Screening Engine.

Pure rule-based matcher. Dynamically interprets criteria strings to evaluate
patient data. No hardcoded trial conditions.

Decision logic:
  - ELIGIBLE      : All inclusion criteria met AND zero exclusion criteria triggered
  - INELIGIBLE    : At least one exclusion criterion triggered OR a required
                    inclusion criterion definitively failed
  - REQUIRES_REVIEW: Ambiguous or insufficient data to make a confident call
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

from schemas.patient_schema import EligibilityDecision, ScreenPatientResponse
from utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _flatten(obj: Any, prefix: str = "") -> Dict[str, Any]:
    """Recursively flatten a nested dict into dot-path keys."""
    items: Dict[str, Any] = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_key = f"{prefix}.{k}" if prefix else k
            items.update(_flatten(v, new_key))
    else:
        items[prefix] = obj
    return items


def _find_value(patient_flat: Dict[str, Any], keyword: str) -> Tuple[Any, str]:
    """
    Search flattened patient dict for a key that matches `keyword`.
    Returns (value, dot-path) or (None, "").
    """
    keyword_lower = keyword.lower().replace(" ", "_").replace("-", "_")
    for path, val in patient_flat.items():
        path_normalized = path.lower().replace("-", "_").replace(" ", "_")
        if keyword_lower in path_normalized or path_normalized in keyword_lower:
            return val, path
    return None, ""


def _parse_numeric_range(criterion: str) -> Tuple[str | None, float | None, float | None]:
    """
    Extract a field name and numeric range from a criterion string.

    Examples:
      "Age 18–65"       -> ("age", 18.0, 65.0)
      "HbA1c 6.5-9.0"  -> ("hba1c", 6.5, 9.0)
      "BMI > 18.5"      -> ("bmi", 18.5, None)  with implied direction
    """
    # Pattern: <word(s)> <number>–<number>  (handles -, –, to, between)
    range_pattern = re.compile(
        r"([\w\s]+?)\s+(\d+\.?\d*)\s*[-–—to]+\s*(\d+\.?\d*)",
        re.IGNORECASE,
    )
    gt_pattern = re.compile(r"([\w\s]+?)\s*(?:>|>=|≥|at least)\s*(\d+\.?\d*)", re.IGNORECASE)
    lt_pattern = re.compile(r"([\w\s]+?)\s*(?:<|<=|≤|no more than|at most)\s*(\d+\.?\d*)", re.IGNORECASE)

    m = range_pattern.search(criterion)
    if m:
        field = m.group(1).strip().lower().replace(" ", "_")
        return field, float(m.group(2)), float(m.group(3))

    m = gt_pattern.search(criterion)
    if m:
        field = m.group(1).strip().lower().replace(" ", "_")
        return field, float(m.group(2)), None

    m = lt_pattern.search(criterion)
    if m:
        field = m.group(1).strip().lower().replace(" ", "_")
        return field, None, float(m.group(2))

    return None, None, None


def _check_criterion(
    criterion: str,
    patient_flat: Dict[str, Any],
    is_exclusion: bool = False,
) -> Tuple[bool | None, str, str]:
    """
    Evaluate a single criterion against the patient.

    Returns:
        (result, evidence_string, source_ref)
        result = True  → criterion is satisfied (inclusion) or triggered (exclusion)
        result = False → criterion is NOT satisfied
        result = None  → cannot determine (insufficient data)
    """
    crit_lower = criterion.lower()

    # --- Numeric range check ---
    field, lo, hi = _parse_numeric_range(criterion)
    if field:
        val, path = _find_value(patient_flat, field)
        if val is not None:
            try:
                num_val = float(val)
                in_range = True
                if lo is not None and num_val < lo:
                    in_range = False
                if hi is not None and num_val > hi:
                    in_range = False

                label = field.replace("_", " ").title()
                range_str = f"{lo}–{hi}" if lo and hi else (f"≥{lo}" if lo else f"≤{hi}")
                if in_range:
                    evidence = f"{label} {num_val} satisfies requirement ({range_str})"
                else:
                    evidence = f"{label} {num_val} does NOT satisfy requirement ({range_str})"
                return in_range, evidence, path
            except (ValueError, TypeError):
                pass

    # --- Boolean / presence check for exclusion conditions ---
    # e.g. "Kidney disease", "Pregnancy", "History of stroke"
    # Look for matching key with truthy value
    words = re.findall(r"\b\w{3,}\b", crit_lower)
    stop_words = {"the", "and", "for", "with", "has", "have", "any", "history", "of", "no", "not"}
    keywords = [w for w in words if w not in stop_words]

    for kw in keywords:
        val, path = _find_value(patient_flat, kw)
        if val is not None:
            # Treat True/1/"yes"/"true" as condition present
            present = False
            if isinstance(val, bool):
                present = val
            elif isinstance(val, (int, float)):
                present = val != 0
            elif isinstance(val, str):
                present = val.lower() in {"yes", "true", "1", "positive", "present"}

            label = kw.replace("_", " ").title()
            if is_exclusion:
                if present:
                    evidence = f"Exclusion triggered: {label} detected"
                    return True, evidence, path
                else:
                    evidence = f"No {label} detected"
                    return False, evidence, path
            else:
                # For inclusion, just note we found the field
                if present:
                    evidence = f"{label} is present (satisfies '{criterion}')"
                    return True, evidence, path
                else:
                    evidence = f"{label} is absent (does not satisfy '{criterion}')"
                    return False, evidence, path

    # Could not evaluate
    return None, f"Insufficient data to evaluate: '{criterion}'", ""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_EV_STOP = {"the", "and", "for", "with", "has", "have", "any", "history", "of", "no", "not"}


def _extract_patient_value(criterion: str, patient_flat: Dict[str, Any]) -> str | None:
    """Best-effort pull of the patient's actual value for a criterion (for the UI)."""
    field, _lo, _hi = _parse_numeric_range(criterion)
    if field:
        val, _ = _find_value(patient_flat, field)
        if val is not None:
            return str(val)
    for kw in re.findall(r"\b\w{3,}\b", criterion.lower()):
        if kw in _EV_STOP:
            continue
        val, _ = _find_value(patient_flat, kw)
        if val is not None:
            if isinstance(val, bool):
                return "yes" if val else "no"
            return str(val)
    return None


def evidence_objects(criteria: Dict[str, List[str]], patient: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Structured eligibility evidence for the UI: one object per criterion with a
    boolean `met` (green check = good) plus the patient's actual value.

      inclusion -> met = criterion satisfied
      exclusion -> met = criterion NOT triggered (i.e. safe)
    """
    flat = _flatten(patient)
    out: List[Dict[str, Any]] = []

    for crit in criteria.get("inclusion", []):
        result, ev, ref = _check_criterion(crit, flat, is_exclusion=False)
        out.append({
            "criterion": crit,
            "met": result is True,
            "unknown": result is None,
            "patient_value": _extract_patient_value(crit, flat),
            "source": ref or "inclusion",
            "detail": ev,
        })

    for crit in criteria.get("exclusion", []):
        result, ev, ref = _check_criterion(crit, flat, is_exclusion=True)
        out.append({
            "criterion": crit,
            "met": result is False,          # not triggered = good
            "unknown": result is None,
            "patient_value": _extract_patient_value(crit, flat),
            "source": ref or "exclusion",
            "detail": ev,
        })

    return out


def screen_patient(
    criteria: Dict[str, List[str]],
    patient: Dict[str, Any],
) -> ScreenPatientResponse:
    """
    Evaluate a patient against the provided trial criteria.

    Args:
        criteria: {"inclusion": [...], "exclusion": [...]}
        patient:  Arbitrary patient data dict (may be nested).

    Returns:
        ScreenPatientResponse with decision, confidence, evidence, and source refs.
    """
    patient_flat = _flatten(patient)

    evidence: List[str] = []
    source_refs: List[str] = []

    inclusion_results: List[bool | None] = []
    exclusion_results: List[bool | None] = []

    # --- Evaluate inclusion criteria ---
    for criterion in criteria.get("inclusion", []):
        result, ev, ref = _check_criterion(criterion, patient_flat, is_exclusion=False)
        inclusion_results.append(result)
        evidence.append(f"[INCLUSION] {ev}")
        if ref:
            source_refs.append(ref)
        logger.debug("Inclusion criterion '%s' -> %s", criterion, result)

    # --- Evaluate exclusion criteria ---
    for criterion in criteria.get("exclusion", []):
        result, ev, ref = _check_criterion(criterion, patient_flat, is_exclusion=True)
        exclusion_results.append(result)
        evidence.append(f"[EXCLUSION] {ev}")
        if ref:
            source_refs.append(ref)
        logger.debug("Exclusion criterion '%s' -> %s", criterion, result)

    # --- Decision logic ---
    exclusion_triggered = any(r is True for r in exclusion_results)
    inclusion_failed = any(r is False for r in inclusion_results)
    has_unknown = any(r is None for r in (inclusion_results + exclusion_results))

    if exclusion_triggered:
        decision = EligibilityDecision.INELIGIBLE
        confidence = 0.95
    elif inclusion_failed:
        decision = EligibilityDecision.INELIGIBLE
        confidence = 0.90
    elif has_unknown:
        decision = EligibilityDecision.REQUIRES_REVIEW
        confidence = 0.55
    else:
        decision = EligibilityDecision.ELIGIBLE
        known_count = sum(1 for r in inclusion_results if r is not None)
        total = max(len(inclusion_results) + len(exclusion_results), 1)
        confidence = min(0.99, 0.75 + 0.25 * (known_count / total))

    logger.info(
        "Screening complete: decision=%s, confidence=%.2f, evidence_count=%d",
        decision.value,
        confidence,
        len(evidence),
    )

    return ScreenPatientResponse(
        decision=decision,
        confidence=round(confidence, 4),
        evidence=evidence,
        source_refs=list(dict.fromkeys(source_refs)),  # deduplicate, preserve order
    )
