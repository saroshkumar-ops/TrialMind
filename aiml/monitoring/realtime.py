"""
monitoring/realtime.py
----------------------
Real-time vital-sign stream for an enrolled patient who is physically in the clinic.
Bedside machines push a fresh reading roughly every 30 seconds; this module
SIMULATES that feed under three operator-selectable scenarios so the safety model
can be demonstrated live:

  normal    -> all vitals in range            -> status "stable"
  moderate  -> several vitals borderline       -> status "watch"
  critical  -> dangerous vitals (e.g. tachycardia + hypoxia + hyperglycaemia)
                                                -> status "critical" (alert + audit)

Status is derived from the ACTUAL values against clinical bounds (not just the chosen
scenario), so the displayed reading and the verdict always agree.
"""

from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

# (crit_low, warn_low, warn_high, crit_high) per vital.
_RANGES = {
    "heart_rate":       (50, 60, 100, 130),
    "systolic_bp":      (90, 90, 139, 180),
    "diastolic_bp":     (55, 60, 89, 110),
    "spo2":             (90, 95, 100, 101),   # low side matters
    "glucose":          (60, 70, 180, 250),
    "respiratory_rate": (8, 12, 20, 27),
    "temperature":      (35.5, 36.0, 37.5, 39.0),
}

_LABEL = {
    "heart_rate": "HR", "systolic_bp": "Systolic", "diastolic_bp": "Diastolic",
    "spo2": "SpO2", "glucose": "Glucose", "respiratory_rate": "Resp. rate",
    "temperature": "Temp",
}
_UNIT = {
    "heart_rate": "bpm", "systolic_bp": "mmHg", "diastolic_bp": "mmHg",
    "spo2": "%", "glucose": "mg/dL", "respiratory_rate": "/min", "temperature": "C",
}

# Generation bands per scenario (diabetic glucose handled separately).
_BANDS = {
    "normal": {
        "heart_rate": (66, 86), "systolic_bp": (112, 130), "diastolic_bp": (72, 82),
        "spo2": (97, 100), "respiratory_rate": (12, 17), "temperature": (36.4, 37.1),
    },
    "moderate": {
        "heart_rate": (101, 120), "systolic_bp": (142, 158), "diastolic_bp": (86, 95),
        "spo2": (93, 95), "respiratory_rate": (21, 25), "temperature": (37.7, 38.4),
    },
    "critical": {
        "heart_rate": (138, 166), "systolic_bp": (184, 206), "diastolic_bp": (106, 119),
        "spo2": (84, 89), "respiratory_rate": (27, 33), "temperature": (38.9, 39.7),
    },
}
_GLUCOSE = {
    "normal":   {"diab": (120, 168), "non": (82, 110)},
    "moderate": {"diab": (190, 240), "non": (150, 185)},
    "critical": {"diab": (300, 375), "non": (260, 330)},
}


def _severity(vital: str, value: float) -> str:
    cl, wl, wh, ch = _RANGES[vital]
    if value < cl or value >= ch:
        return "crit"
    if value < wl or value > wh:
        return "warn"
    return "normal"


def generate_reading(scenario: str, diabetic: bool) -> Dict[str, float]:
    scenario = scenario if scenario in _BANDS else "normal"
    b = _BANDS[scenario]
    rng = random
    g = _GLUCOSE[scenario]["diab" if diabetic else "non"]
    return {
        "heart_rate": rng.randint(*b["heart_rate"]),
        "systolic_bp": rng.randint(*b["systolic_bp"]),
        "diastolic_bp": rng.randint(*b["diastolic_bp"]),
        "spo2": rng.randint(*b["spo2"]),
        "glucose": rng.randint(*g),
        "respiratory_rate": rng.randint(*b["respiratory_rate"]),
        "temperature": round(rng.uniform(*b["temperature"]), 1),
    }


def classify(vitals: Dict[str, float]) -> Tuple[str, Dict[str, str], List[str]]:
    """Return (overall_status, per-vital severity, human-readable alert strings)."""
    sev = {v: _severity(v, val) for v, val in vitals.items() if v in _RANGES}
    worst = "normal"
    for s in sev.values():
        if s == "crit":
            worst = "crit"
            break
        if s == "warn":
            worst = "warn"
    status = {"crit": "critical", "warn": "watch", "normal": "stable"}[worst]

    alerts: List[str] = []
    for v, s in sev.items():
        if s != "normal":
            tag = "HIGH" if vitals[v] > _RANGES[v][2] else "LOW"
            alerts.append(f"{_LABEL[v]} {vitals[v]}{_UNIT[v]} ({'critical' if s == 'crit' else 'elevated'} {tag})")
    # surface critical alerts first
    alerts.sort(key=lambda a: 0 if "critical" in a else 1)
    return status, sev, alerts


def units() -> Dict[str, str]:
    return dict(_UNIT)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
