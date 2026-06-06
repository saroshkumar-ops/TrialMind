"""
data_layer/enroll_schema.py
---------------------------
Derives the patient-enrollment FORM SCHEMA from a trial's extracted criteria.

This is what makes the enrollment form trial-driven: upload a different protocol
PDF → different inclusion/exclusion criteria → different `enroll_fields` → the
frontend renders a different form. The field KEYS are produced by the SAME parser
the screening engine uses (`_parse_numeric_range`), so a value the form collects is
exactly the key the rule engine looks up — they can never drift apart.

A field descriptor:
  { key, label, type: "number"|"boolean"|"select"|"text",
    unit?, min?, max?, options?, required, group: "demographic"|"clinical"|"retention",
    source_criterion? }
"""

from __future__ import annotations

from typing import Any, Dict, List

from screening.screening_engine import _parse_numeric_range

# Nice units/labels for known biomarkers (cosmetic only).
_UNIT = {
    "age": "years", "hba1c": "%", "glucose": "mg/dL", "bmi": "kg/m²",
    "systolic_bp": "mmHg", "diastolic_bp": "mmHg", "fev1": "% predicted",
    "weight": "kg", "heart_rate": "bpm",
}
_LABEL = {
    "hba1c": "HbA1c", "bmi": "BMI", "fev1": "FEV1",
    "systolic_bp": "Systolic BP", "diastolic_bp": "Diastolic BP",
}

# Words dropped when turning a boolean criterion into a field key.
_STOP = {"the", "and", "for", "with", "has", "have", "any", "history", "of",
         "no", "not", "a", "an", "active", "chronic", "prior", "current"}


def _label_for(key: str) -> str:
    return _LABEL.get(key, key.replace("_", " ").title())


def _bool_key(criterion: str) -> str:
    """Turn a boolean criterion into a stable snake_case key the screener will find."""
    import re
    words = re.findall(r"\b\w{3,}\b", criterion.lower())
    kept = [w for w in words if w not in _STOP]
    return "_".join(kept) if kept else re.sub(r"\W+", "_", criterion.lower()).strip("_")


# Always-present fields (independent of the protocol).
def _demographic_fields() -> List[Dict[str, Any]]:
    return [
        {"key": "name", "label": "Full name", "type": "text", "required": True,
         "group": "demographic"},
        {"key": "age", "label": "Age", "type": "number", "unit": "years",
         "min": 0, "max": 120, "required": True, "group": "demographic"},
        {"key": "gender", "label": "Gender", "type": "select",
         "options": ["male", "female", "other"], "required": True, "group": "demographic"},
    ]


# Always-present retention fields (feed the dropout-risk model — trial-agnostic).
def _retention_fields() -> List[Dict[str, Any]]:
    return [
        {"key": "comorbidities", "label": "Comorbidities", "type": "text",
         "placeholder": "comma-separated, e.g. hypertension, obesity",
         "required": False, "group": "retention"},
        {"key": "medications", "label": "Current medications", "type": "text",
         "placeholder": "comma-separated, e.g. metformin", "required": False,
         "group": "retention"},
        {"key": "missed_visits", "label": "Missed visits (last year)", "type": "number",
         "min": 0, "max": 30, "required": False, "group": "retention"},
        {"key": "travel_distance_km", "label": "Distance to site", "type": "number",
         "unit": "km", "min": 0, "max": 500, "required": False, "group": "retention"},
    ]


def derive_enroll_fields(inclusion: List[str], exclusion: List[str]) -> List[Dict[str, Any]]:
    """Build the full enrollment form schema from a trial's criteria."""
    fields: List[Dict[str, Any]] = _demographic_fields()
    seen = {f["key"] for f in fields}

    def add(field: Dict[str, Any]) -> None:
        if field["key"] in seen:
            # Refine the existing field (e.g. age range from the criterion).
            for f in fields:
                if f["key"] == field["key"]:
                    f.update({k: v for k, v in field.items() if k in ("min", "max")})
                    if "source_criterion" in field:
                        f["source_criterion"] = field["source_criterion"]
            return
        seen.add(field["key"])
        fields.append(field)

    # --- Inclusion criteria → clinical fields ---
    for crit in inclusion:
        key, lo, hi = _parse_numeric_range(crit)
        if key:
            f: Dict[str, Any] = {"key": key, "label": _label_for(key), "type": "number",
                                 "required": True, "group": "clinical", "source_criterion": crit}
            if key in _UNIT:
                f["unit"] = _UNIT[key]
            if lo is not None:
                f["min"] = lo
            if hi is not None:
                f["max"] = hi
            add(f)
        else:
            # Non-numeric inclusion (e.g. "Smoking history") → boolean confirm.
            k = _bool_key(crit)
            add({"key": k, "label": crit, "type": "boolean", "required": False,
                 "group": "clinical", "source_criterion": crit})

    # --- Exclusion criteria → boolean fields ---
    for crit in exclusion:
        k = _bool_key(crit)
        add({"key": k, "label": crit, "type": "boolean", "required": False,
             "group": "clinical", "is_exclusion": True, "source_criterion": crit})

    # --- Retention fields (always) ---
    fields.extend(_retention_fields())
    return fields
