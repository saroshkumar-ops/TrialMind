"""
synthesis/escalation_engine.py
--------------------------------
Synthesis / Escalation Engine — Day 4 capability.

Rule: "Risk Agent HIGH dropout AND (Adherence non_compliant OR Screening
REQUIRES_REVIEW) → auto-escalate for HITL review."

This is intentionally deterministic (no LLM call) so it never times out
during a live demo.

Public API:
  evaluate_escalation(screening_result, risk_result, adherence_record) -> EscalationResult
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from utils.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------

@dataclass
class EscalationResult:
    escalated: bool
    reason: str
    trigger_agents: List[str] = field(default_factory=list)
    severity: str = "low"          # "low" | "medium" | "high"
    recommended_action: str = ""


# ---------------------------------------------------------------------------
# Escalation rules
# ---------------------------------------------------------------------------

# All rules are evaluated in order; the FIRST that fires wins.
# Each rule is (condition_fn, reason_template, trigger_agents, severity, recommended_action)
_RULES: List[tuple] = [
    (
        # Rule 1 — High risk + non-compliant adherence (most severe)
        lambda s, r, a: (
            r.get("risk_level") == "HIGH"
            and a is not None
            and a.get("adherence_status") == "non_compliant"
        ),
        (
            "Patient flagged HIGH dropout risk by the Risk Agent AND is non-compliant "
            "in the Adherence Agent (missed doses + visits). Dual-agent trigger."
        ),
        ["risk_agent", "adherence_agent"],
        "high",
        "Immediate clinical review — consider protocol deviation notice and retention intervention.",
    ),
    (
        # Rule 2 — High risk + requires-review eligibility
        lambda s, r, a: (
            r.get("risk_level") == "HIGH"
            and s.get("decision") == "REQUIRES_REVIEW"
        ),
        (
            "Patient is HIGH dropout risk AND eligibility could not be confirmed — "
            "ambiguous inclusion criteria and elevated risk require human judgement."
        ),
        ["risk_agent", "screening_agent"],
        "high",
        "Clinical coordinator must review eligibility data and risk factors before enrolment.",
    ),
    (
        # Rule 3 — Medium risk + non-compliant adherence
        lambda s, r, a: (
            r.get("risk_level") == "MEDIUM"
            and a is not None
            and a.get("adherence_status") == "non_compliant"
        ),
        (
            "Patient shows MEDIUM dropout risk with confirmed non-compliance in adherence tracking. "
            "Proactive intervention recommended."
        ),
        ["risk_agent", "adherence_agent"],
        "medium",
        "Schedule retention support call; review travel/logistics barriers.",
    ),
    (
        # Rule 4 — High risk alone (no adherence data)
        lambda s, r, a: (
            r.get("risk_level") == "HIGH"
            and a is None
        ),
        (
            "Patient is HIGH dropout risk. No adherence data available — "
            "cannot rule out compounding risk factors."
        ),
        ["risk_agent"],
        "medium",
        "Gather adherence baseline and reassess within 7 days.",
    ),
    (
        # Rule 5 — Very low adherence rate even at medium risk
        lambda s, r, a: (
            a is not None
            and float(a.get("adherence_rate", 1.0)) < 0.70
        ),
        (
            "Patient adherence rate is below 70% — protocol deviation threshold crossed "
            "regardless of predicted risk score."
        ),
        ["adherence_agent"],
        "medium",
        "Protocol deviation notice required. Investigate root cause of missed doses.",
    ),
]


def evaluate_escalation(
    screening_result: Dict[str, Any],
    risk_result: Dict[str, Any],
    adherence_record: Optional[Dict[str, Any]] = None,
) -> EscalationResult:
    """
    Evaluate whether a patient should be auto-escalated for human review.

    Args:
        screening_result:  Dict with at least {"decision": "ELIGIBLE"|"INELIGIBLE"|"REQUIRES_REVIEW", "confidence": float}.
        risk_result:       Dict with at least {"risk_level": "LOW"|"MEDIUM"|"HIGH", "risk_score": float}.
        adherence_record:  Optional dict from adherence_overlay with adherence_status + adherence_rate.

    Returns:
        EscalationResult — escalated=True means the patient needs HITL review.
    """
    # Normalise keys for robust rule matching
    s = {k.lower(): v for k, v in screening_result.items()} if screening_result else {}
    r = {k.lower(): v for k, v in risk_result.items()} if risk_result else {}
    a = {k.lower(): v for k, v in adherence_record.items()} if adherence_record else None

    for condition, reason, triggers, severity, rec_action in _RULES:
        try:
            if condition(s, r, a):
                result = EscalationResult(
                    escalated=True,
                    reason=reason,
                    trigger_agents=triggers,
                    severity=severity,
                    recommended_action=rec_action,
                )
                logger.info(
                    "Escalation triggered: severity=%s triggers=%s",
                    severity,
                    triggers,
                )
                return result
        except (KeyError, TypeError, ValueError) as exc:
            logger.warning("Escalation rule evaluation error (skipping rule): %s", exc)
            continue

    logger.info("No escalation triggered for patient.")
    return EscalationResult(
        escalated=False,
        reason="No escalation criteria met. Patient within normal monitoring parameters.",
        trigger_agents=[],
        severity="low",
        recommended_action="Continue standard trial monitoring protocol.",
    )
