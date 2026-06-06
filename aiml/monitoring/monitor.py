"""
monitoring/monitor.py
---------------------
Composite per-visit monitoring (Phase 3 climax).

For one enrolled patient's visit reading, combines:
  - SAFETY  : IsolationForest vitals anomaly (vitals_anomaly.score_reading)
  - EFFICACY: treatment-response trajectory vs protocol (efficacy.evaluate_efficacy),
              built from this patient's recorded visit history + the new reading
  - DROPOUT : the existing XGBoost risk score (re-run on stored features)
  - ADHERENCE: the patient's adherence overlay status (if any)

Emits a monitoring_status (stable | watch | alert), a deterministic composite
escalation, persists the visit, and writes a hash-chained audit entry.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_BIOMARKER = "hba1c"


def run_visit(
    patient_id: str,
    trial_id: Optional[str],
    visit_date: str,
    vitals: Dict[str, Any],
    biomarker: str = DEFAULT_BIOMARKER,
    actor: str = "monitoring_agent",
) -> Dict[str, Any]:
    from data_layer import registry, visit_store
    from monitoring.vitals_anomaly import score_reading
    from monitoring.efficacy import evaluate_efficacy
    from prediction.predictor import predict_risk
    from audit.audit_trail import log_decision

    # --- SAFETY ---
    safety = score_reading(vitals)

    # --- EFFICACY (history + this reading) ---
    prior = visit_store.biomarker_series_from_visits(patient_id, biomarker)
    series = prior + ([{"date": visit_date, "value": vitals[biomarker]}]
                      if vitals.get(biomarker) is not None else [])
    adherence = registry.adherence_record(patient_id)
    adherence_rate = adherence.get("adherence_rate") if adherence else None
    adherence_status = adherence.get("adherence_status") if adherence else None
    efficacy = evaluate_efficacy(
        biomarker, series, adherence_rate=adherence_rate, visit_count=len(prior) + 1
    )

    # --- DROPOUT RISK (re-run on stored features) ---
    risk_level = None
    risk_score = None
    feats = registry.feature_dict(patient_id)
    if feats:
        rr = predict_risk(feats)
        if not (isinstance(rr, dict) and "error" in rr):
            risk_score = round(rr.risk_score, 4)
            risk_level = rr.risk_level.value

    # --- COMPOSITE ESCALATION (deterministic) ---
    triggers = []
    if safety.get("is_anomaly"):
        triggers.append("vital_anomaly")
    if efficacy.get("status") == "below_expected" and risk_level == "HIGH":
        triggers.append("non_response_high_dropout")
    if adherence_status == "non_compliant" and efficacy.get("status") == "below_expected":
        triggers.append("non_adherence_non_response")

    escalated = len(triggers) > 0
    if escalated:
        severity = "high" if "vital_anomaly" in triggers else "medium"
        reason = "; ".join({
            "vital_anomaly": f"Safety: {safety.get('detail')}",
            "non_response_high_dropout": "Efficacy below expected AND high dropout risk.",
            "non_adherence_non_response": "Non-compliant adherence AND below-expected response.",
        }[t] for t in triggers)
        recommended = ("Immediate clinical review — safety + retention intervention."
                       if "vital_anomaly" in triggers
                       else "Schedule follow-up — treatment response below target.")
        monitoring_status = "alert"
    else:
        severity = "low"
        reason = "All monitoring signals within expected ranges."
        recommended = "Continue per protocol."
        monitoring_status = "watch" if efficacy.get("status") == "below_expected" else "stable"

    monitor = {
        "patient_id": patient_id,
        "visit_date": visit_date,
        "monitoring_status": monitoring_status,
        "safety": safety,
        "efficacy": efficacy,
        "dropout": {"risk_level": risk_level, "risk_score": risk_score},
        "adherence_status": adherence_status,
        "escalation": {
            "escalated": escalated,
            "severity": severity,
            "trigger_agents": triggers,
            "reason": reason,
            "recommended_action": recommended,
        },
    }

    # --- PERSIST + AUDIT ---
    visit_id = visit_store.add_visit(patient_id, trial_id, visit_date, vitals, monitor)
    monitor["visit_id"] = visit_id

    audit_id = log_decision(
        action="MONITORING_VISIT",
        patient_id=patient_id,
        actor=actor,
        payload={
            "visit_id": visit_id,
            "monitoring_status": monitoring_status,
            "is_anomaly": safety.get("is_anomaly"),
            "anomaly_score": safety.get("anomaly_score"),
            "efficacy_status": efficacy.get("status"),
            "risk_level": risk_level,
            "escalated": escalated,
            "trigger_agents": triggers,
        },
    )
    if escalated:
        log_decision(
            action="ESCALATION",
            patient_id=patient_id,
            actor="monitoring_engine",
            payload={"reason": reason, "severity": severity,
                     "trigger_agents": triggers, "monitoring_audit_id": audit_id},
        )
    monitor["audit_id"] = audit_id

    logger.info("Monitoring visit %s patient=%s status=%s escalated=%s",
                visit_id, patient_id, monitoring_status, escalated)
    return monitor
