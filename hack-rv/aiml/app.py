"""
app.py
------
TrialMind AIML Microservice — FastAPI entry point.

Endpoints:
  GET  /health                → Service health check
  GET  /model-info            → Loaded model metadata
  POST /extract-protocol      → Protocol criteria extraction (Groq LLM, text)
  POST /extract-protocol-pdf  → Protocol criteria extraction from uploaded PDF file
  POST /screen-patient        → Rule-based eligibility screening
  POST /predict-risk          → XGBoost risk prediction + SHAP explanations
  POST /fairness-audit        → Demographic fairness analysis
  POST /explain-eligibility   → LLM explanation of an eligibility decision
  POST /consent-summary       → Patient-friendly plain-language protocol summary
  POST /orchestrate           → End-to-end pipeline: extract → screen → risk → escalate → audit
  POST /hitl-review           → Record clinician approve/override/escalate on an audit entry
  GET  /audit-trail           → Return full tamper-evident audit log with chain verification
  POST /analyze-data          → Biomarker spike detection from an Observation time-series
  GET  /adherence-overlay     → Serve the pre-computed adherence overlay JSON

  --- Data layer (Python owns patients + trials; frontend calls these directly) ---
  GET/POST /trials                       → list / create trials
  GET      /trials/{id}                  → get one trial
  POST     /trials/{id}/protocol         → upload protocol PDF, store extracted criteria
  GET      /patients                     → list cohort (registry)
  GET      /patients/{id}                → get one patient (features + adherence)
  POST     /patients                     → self-enroll a patient (+ optional auto-screen)
  GET      /trials/{id}/screen-cohort    → Tier 1 bulk screen (assembled from DB)
  POST     /patients/{id}/orchestrate    → Tier 2 full pipeline (assembled from DB)

Run:
    uvicorn app:app --reload --port 8000
"""

import json
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown hooks)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: attempt to pre-load the model (non-blocking if absent)."""
    logger.info("=== TrialMind AIML Service Starting ===")
    logger.info("Environment : %s", settings.app_env)
    logger.info("Groq model  : %s", settings.groq_model)
    logger.info("Groq ready  : %s", settings.groq_configured)

    # Bootstrap the SQLite data layer (Python now owns the data — no Java backend).
    try:
        from data_layer.db import init_db
        from data_layer.registry import seed_cohort
        from data_layer.trial_store import seed_default_trial
        init_db()
        seeded = seed_cohort()
        seed_default_trial()
        logger.info("Data layer ready (%d patients seeded this boot)", seeded)
    except Exception as e:
        logger.error("Data layer bootstrap failed: %s", e, exc_info=True)

    # Attempt to pre-load model (silently skipped if not yet trained)
    try:
        from prediction.predictor import ModelState
        ModelState.get().try_load()
    except Exception as e:
        logger.warning("Model pre-load skipped: %s", e)

    # Phase 3: train the safety anomaly model if missing OR if its feature vector is
    # stale (calibrated to the enriched cohort). Fast (~1s on 222 rows).
    try:
        from monitoring.vitals_anomaly import is_trained, model_matches, train
        if not is_trained() or not model_matches():
            train()
            logger.info("Anomaly model (re)trained on startup")
    except Exception as e:
        logger.warning("Anomaly model auto-train skipped: %s", e)

    yield  # Application is running

    logger.info("=== TrialMind AIML Service Stopped ===")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="TrialMind AIML Microservice",
    description=(
        "Explainable AI service for clinical trial optimisation. "
        "Provides protocol extraction, patient screening, risk prediction, "
        "explainability, and fairness auditing."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — allow Spring Boot backend to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)


# ---------------------------------------------------------------------------
# Request logging middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    logger.info("→ %s %s", request.method, request.url.path)
    try:
        response = await call_next(request)
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "← %s %s | status=%d | %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            elapsed,
        )
        return response
    except Exception as e:
        elapsed = (time.perf_counter() - start) * 1000
        logger.error("← %s %s | ERROR | %.1fms | %s", request.method, request.url.path, elapsed, e)
        raise


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


# ---------------------------------------------------------------------------
# Health & Info endpoints
# ---------------------------------------------------------------------------

@app.get(
    "/health",
    summary="Health Check",
    tags=["Infrastructure"],
    response_model=Dict[str, Any],
)
async def health():
    """Returns service liveness status and basic diagnostics."""
    from prediction.predictor import ModelState
    state = ModelState.get()
    return {
        "status": "ok",
        "service": "TrialMind AIML",
        "version": "1.0.0",
        "environment": settings.app_env,
        "groq_configured": settings.groq_configured,
        "model_loaded": state.loaded,
    }


@app.get(
    "/model-info",
    summary="Model Information",
    tags=["Infrastructure"],
    response_model=Dict[str, Any],
)
async def model_info():
    """Returns metadata about the currently loaded XGBoost model."""
    from prediction.predictor import get_model_info
    return get_model_info()


# ---------------------------------------------------------------------------
# Module 1 — Protocol Extraction
# ---------------------------------------------------------------------------

from schemas.protocol_schema import ProtocolExtractionRequest, ProtocolExtractionResponse


@app.post(
    "/extract-protocol",
    summary="Extract Protocol Criteria",
    tags=["Protocol"],
    response_model=ProtocolExtractionResponse,
)
async def extract_protocol(request: ProtocolExtractionRequest):
    """
    Extract structured inclusion/exclusion criteria from raw clinical trial text
    using the Groq LLM.

    Falls back to regex-based extraction if Groq is not configured.
    """
    from protocol.parser import parse_protocol, parse_protocol_fallback, ProtocolParseError

    logger.info("Protocol extraction request (text_length=%d)", len(request.protocol_text))

    try:
        if settings.groq_configured:
            criteria = parse_protocol(request.protocol_text)
        else:
            logger.warning("Groq not configured — using regex fallback parser.")
            criteria = parse_protocol_fallback(request.protocol_text)

    except ProtocolParseError as e:
        logger.error("Protocol parse failed after retries: %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("Unexpected protocol extraction error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")

    return ProtocolExtractionResponse(
        inclusion=criteria.inclusion,
        exclusion=criteria.exclusion,
        confidence=criteria.confidence,
        raw_text_length=len(request.protocol_text),
    )


# ---------------------------------------------------------------------------
# Module 2 — Patient Screening
# ---------------------------------------------------------------------------

from schemas.patient_schema import ScreenPatientRequest, ScreenPatientResponse


@app.post(
    "/screen-patient",
    summary="Screen Patient Eligibility",
    tags=["Screening"],
    response_model=ScreenPatientResponse,
)
async def screen_patient(request: ScreenPatientRequest):
    """
    Evaluate a patient's eligibility against extracted trial criteria.

    Returns ELIGIBLE, INELIGIBLE, or REQUIRES_REVIEW with evidence and confidence.
    """
    from screening.screening_engine import screen_patient as _screen

    logger.info(
        "Screening request: %d inclusion, %d exclusion criteria",
        len(request.criteria.inclusion),
        len(request.criteria.exclusion),
    )

    try:
        result = _screen(
            criteria=request.criteria.model_dump(),
            patient=request.patient,
        )
        return result
    except Exception as e:
        logger.error("Screening error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Screening failed: {e}")


# ---------------------------------------------------------------------------
# Module 2b — Cohort Screening (Tier 1: bulk, cheap path, NO LLM, NO audit)
# ---------------------------------------------------------------------------

from schemas.patient_schema import (
    CohortScreenRequest,
    CohortScreenResponse,
    CohortScreenResult,
)


@app.post(
    "/screen-cohort",
    summary="Bulk Screen a Cohort",
    tags=["Screening"],
    response_model=CohortScreenResponse,
)
async def screen_cohort(request: CohortScreenRequest):
    """
    Screen a whole cohort in ONE call — the fast 'Tier 1' path for the screening
    dashboard. Runs rule-based eligibility + XGBoost risk for every patient, with
    NO Groq explanation and NO per-patient audit write (those are reserved for the
    single-patient /orchestrate deep-dive). Designed to handle the full cohort live.

    Returns a lightweight, ranked list (ELIGIBLE first, then by descending risk).
    """
    from screening.screening_engine import screen_patient as _screen
    from prediction.predictor import predict_risk as _predict

    criteria = request.criteria.model_dump()
    logger.info("Cohort screen: %d patients", len(request.patients))

    results: list[CohortScreenResult] = []
    for cp in request.patients:
        # Rule-based eligibility (fast)
        screen = _screen(criteria=criteria, patient=cp.patient)

        # Risk (fast; gracefully mark unavailable if model untrained / bad input)
        risk_score = None
        risk_level = None
        risk_unavailable = False
        try:
            rr = _predict(cp.patient_features) if cp.patient_features else {"error": "no features"}
            if isinstance(rr, dict) and "error" in rr:
                risk_unavailable = True
            else:
                risk_score = round(rr.risk_score, 4)
                risk_level = rr.risk_level
        except Exception as e:
            logger.warning("Cohort risk failed for %s (non-fatal): %s", cp.patient_id, e)
            risk_unavailable = True

        results.append(
            CohortScreenResult(
                patient_id=cp.patient_id,
                name=cp.name,
                decision=screen.decision,
                confidence=screen.confidence,
                risk_score=risk_score,
                risk_level=risk_level,
                risk_unavailable=risk_unavailable,
            )
        )

    # Rank: ELIGIBLE first, then REQUIRES_REVIEW, then INELIGIBLE; within each, highest risk first
    decision_order = {"ELIGIBLE": 0, "REQUIRES_REVIEW": 1, "INELIGIBLE": 2}
    results.sort(
        key=lambda r: (
            decision_order.get(r.decision.value, 9),
            -(r.risk_score if r.risk_score is not None else -1),
        )
    )

    summary: dict[str, int] = {}
    for r in results:
        summary[r.decision.value] = summary.get(r.decision.value, 0) + 1

    return CohortScreenResponse(total=len(results), summary=summary, results=results)


# ---------------------------------------------------------------------------
# Module 4+5 — Risk Prediction + SHAP
# ---------------------------------------------------------------------------

from schemas.patient_schema import PredictRiskRequest, PredictRiskResponse


@app.post(
    "/predict-risk",
    summary="Predict Patient Risk",
    tags=["Prediction"],
)
async def predict_risk(request: PredictRiskRequest):
    """
    Predict dropout/trial risk using the trained XGBoost model.

    Includes top 5 SHAP factors for explainability.
    Returns a structured error if model is not yet trained (does NOT crash).
    """
    from prediction.predictor import predict_risk as _predict

    logger.info("Risk prediction request: %d features", len(request.patient_features))

    try:
        result = _predict(request.patient_features)

        # If result is a dict with "error" key, return as 422 with explanation
        if isinstance(result, dict) and "error" in result:
            return JSONResponse(status_code=422, content=result)

        return result

    except Exception as e:
        logger.error("Prediction endpoint error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")


# ---------------------------------------------------------------------------
# Module 6 — Fairness Audit
# ---------------------------------------------------------------------------

from schemas.patient_schema import FairnessAuditRequest, FairnessAuditResponse


@app.post(
    "/fairness-audit",
    summary="Fairness Audit",
    tags=["Fairness"],
    response_model=FairnessAuditResponse,
)
async def fairness_audit(request: FairnessAuditRequest):
    """
    Analyse a patient cohort for demographic representation.

    Returns gender + age distributions, underrepresentation warnings,
    and actionable recommendations.
    """
    from fairness.fairness_audit import audit_fairness

    logger.info("Fairness audit request: %d patients", len(request.patients))

    try:
        result = audit_fairness(request.patients)
        return result
    except Exception as e:
        logger.error("Fairness audit error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Fairness audit failed: {e}")


# ---------------------------------------------------------------------------
# Module 7 — Eligibility Explanation (Groq LLM)
# ---------------------------------------------------------------------------

from schemas.orchestration_schema import (
    EligibilityExplanationRequest,
    EligibilityExplanationResponse,
    ConsentSummaryRequest,
    ConsentSummaryResponse,
    OrchestrationRequest,
    OrchestrationResponse,
    EscalationDetail,
    HITLReviewRequest,
    HITLReviewResponse,
    AuditTrailResponse,
)


@app.post(
    "/explain-eligibility",
    summary="Explain Eligibility Decision",
    tags=["Explanation"],
    response_model=EligibilityExplanationResponse,
)
async def explain_eligibility(request: EligibilityExplanationRequest):
    """
    Generate a plain-English 2–4 sentence explanation of why a patient received
    a given eligibility decision, referencing actual patient values.

    Falls back to a rule-based summary if Groq is not configured.
    """
    from utils.groq_client import generate_eligibility_explanation

    logger.info("Eligibility explanation request: decision=%s", request.decision)

    if not settings.groq_configured:
        # Deterministic fallback — no LLM needed
        fallback = (
            f"Patient was classified as {request.decision} based on rule-based "
            "evaluation of the supplied trial criteria. "
            "Groq LLM is not configured; detailed narrative explanation is unavailable."
        )
        return EligibilityExplanationResponse(
            explanation=fallback,
            decision=request.decision,
            generated_by="rule-based-fallback",
        )

    try:
        explanation = generate_eligibility_explanation(
            criteria=request.criteria,
            patient=request.patient,
            decision=request.decision,
        )
        return EligibilityExplanationResponse(
            explanation=explanation,
            decision=request.decision,
            generated_by=f"groq/{settings.groq_model}",
        )
    except Exception as e:
        logger.error("Eligibility explanation error: %s", e, exc_info=True)
        raise HTTPException(status_code=503, detail=f"Explanation generation failed: {e}")


# ---------------------------------------------------------------------------
# Module 8 — Consent Summary (Groq LLM)
# ---------------------------------------------------------------------------

@app.post(
    "/consent-summary",
    summary="Generate Patient Consent Summary",
    tags=["Explanation"],
    response_model=ConsentSummaryResponse,
)
async def consent_summary(request: ConsentSummaryRequest):
    """
    Produce a patient-friendly plain-language summary (≤150 words) of a
    clinical trial protocol, suitable for use on informed consent forms.

    Falls back to a generic notice if Groq is not configured.
    """
    from utils.groq_client import generate_consent_summary

    logger.info("Consent summary request: text_length=%d", len(request.protocol_text))

    if not settings.groq_configured:
        fallback = (
            "This clinical trial protocol describes research conducted under "
            "strict ethical guidelines. Participation is voluntary and you may "
            "withdraw at any time. Please speak with your care team for full details."
        )
        return ConsentSummaryResponse(
            summary=fallback,
            word_count=len(fallback.split()),
            generated_by="static-fallback",
        )

    try:
        summary_text = generate_consent_summary(request.protocol_text)
        return ConsentSummaryResponse(
            summary=summary_text,
            word_count=len(summary_text.split()),
            generated_by=f"groq/{settings.groq_model}",
        )
    except Exception as e:
        logger.error("Consent summary error: %s", e, exc_info=True)
        raise HTTPException(status_code=503, detail=f"Consent summary generation failed: {e}")


# ---------------------------------------------------------------------------
# Module 9 — End-to-End Orchestration
# ---------------------------------------------------------------------------

@app.post(
    "/orchestrate",
    summary="End-to-End Trial Pipeline",
    tags=["Orchestration"],
    response_model=OrchestrationResponse,
)
async def orchestrate(request: OrchestrationRequest):
    """
    Single endpoint that chains the full TrialMind pipeline:

    1. Extract criteria from protocol text (Groq or regex fallback)
    2. Screen patient against extracted criteria
    3. Predict dropout risk (XGBoost + SHAP)
    4. Evaluate synthesis / escalation rules
    5. Optionally generate a Groq eligibility explanation
    6. Persist all results to the hash-chained audit trail

    Returns a consolidated response with all agent outputs and an audit_id.
    """
    from protocol.parser import parse_protocol, parse_protocol_fallback, ProtocolParseError
    from screening.screening_engine import screen_patient as _screen, evidence_objects
    from prediction.predictor import predict_risk as _predict
    from synthesis.escalation_engine import evaluate_escalation
    from audit.audit_trail import log_decision
    from utils.groq_client import generate_eligibility_explanation

    logger.info(
        "Orchestration request: patient_id=%s actor=%s",
        request.patient_id,
        request.actor,
    )

    # ── Step 1: Protocol extraction ──────────────────────────────────────────
    try:
        if settings.groq_configured:
            criteria_obj = parse_protocol(request.protocol_text)
        else:
            criteria_obj = parse_protocol_fallback(request.protocol_text)
    except ProtocolParseError as e:
        raise HTTPException(status_code=422, detail=f"Protocol extraction failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Protocol extraction error: {e}")

    criteria_dict = criteria_obj.model_dump()

    # ── Step 2: Patient screening ─────────────────────────────────────────────
    try:
        screen_result = _screen(criteria=criteria_dict, patient=request.patient)
        screen_dict = screen_result.model_dump()
        # Convert enum to string for downstream use
        screen_dict["decision"] = screen_result.decision.value
    except Exception as e:
        logger.error("Screening failed in orchestration: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Screening failed: {e}")

    # ── Step 3: Risk prediction (graceful if model not trained) ───────────────
    risk_dict: Dict[str, Any] = {}
    risk_unavailable = False
    risk_top_factors: list = []
    try:
        risk_result = _predict(request.patient_features)
        if isinstance(risk_result, dict) and "error" in risk_result:
            # Model not trained yet — don't crash, mark as unavailable
            risk_unavailable = True
            logger.warning("Risk model unavailable during orchestration: %s", risk_result["error"])
        else:
            risk_dict = risk_result.model_dump()
            risk_dict["risk_level"] = risk_result.risk_level.value
            risk_top_factors = [
                {"feature": f.feature, "impact": f.impact}
                for f in risk_result.top_factors
            ]
    except Exception as e:
        risk_unavailable = True
        logger.warning("Risk prediction failed in orchestration (non-fatal): %s", e)

    # ── Step 4: Escalation synthesis ──────────────────────────────────────────
    escalation = evaluate_escalation(
        screening_result=screen_dict,
        risk_result=risk_dict,
        adherence_record=request.adherence_record,
    )

    # ── Step 5: Optional eligibility explanation ──────────────────────────────
    explanation: str | None = None
    if request.include_explanation:
        if settings.groq_configured:
            try:
                explanation = generate_eligibility_explanation(
                    criteria=criteria_dict,
                    patient=request.patient,
                    decision=screen_dict["decision"],
                )
            except Exception as exp_err:
                logger.warning("Explanation generation failed (non-fatal): %s", exp_err)
                explanation = None
        else:
            explanation = (
                f"Patient classified as {screen_dict['decision']} "
                "(confidence {:.0%}). ".format(screen_dict.get("confidence", 0))
                + "Detailed LLM explanation requires Groq API key."
            )

    # ── Step 6: Audit log ─────────────────────────────────────────────────────
    audit_payload = {
        "protocol_confidence": criteria_obj.confidence,
        "screening_decision": screen_dict["decision"],
        "screening_confidence": screen_dict["confidence"],
        "risk_level": risk_dict.get("risk_level") if not risk_unavailable else "UNAVAILABLE",
        "risk_score": risk_dict.get("risk_score") if not risk_unavailable else None,
        "escalated": escalation.escalated,
        "escalation_severity": escalation.severity,
        "trigger_agents": escalation.trigger_agents,
    }
    audit_id = log_decision(
        action="ORCHESTRATION",
        patient_id=request.patient_id,
        actor=request.actor,
        payload=audit_payload,
    )
    if escalation.escalated:
        log_decision(
            action="ESCALATION",
            patient_id=request.patient_id,
            actor="escalation_engine",
            payload={
                "reason": escalation.reason,
                "severity": escalation.severity,
                "trigger_agents": escalation.trigger_agents,
                "recommended_action": escalation.recommended_action,
                "orchestration_audit_id": audit_id,
            },
        )

    logger.info(
        "Orchestration complete: patient=%s decision=%s escalated=%s audit_id=%s",
        request.patient_id,
        screen_dict["decision"],
        escalation.escalated,
        audit_id,
    )

    return OrchestrationResponse(
        patient_id=request.patient_id,
        criteria=criteria_dict,
        protocol_confidence=criteria_obj.confidence,
        screening_decision=screen_dict["decision"],
        screening_confidence=screen_dict["confidence"],
        screening_evidence=evidence_objects(criteria_dict, request.patient),
        risk_score=risk_dict.get("risk_score") if not risk_unavailable else None,
        risk_level=risk_dict.get("risk_level") if not risk_unavailable else None,
        risk_top_factors=risk_top_factors,
        risk_unavailable=risk_unavailable,
        escalation=EscalationDetail(
            escalated=escalation.escalated,
            reason=escalation.reason,
            trigger_agents=escalation.trigger_agents,
            severity=escalation.severity,
            recommended_action=escalation.recommended_action,
        ),
        eligibility_explanation=explanation,
        audit_id=audit_id,
    )


# ---------------------------------------------------------------------------
# Module 10 — HITL Review
# ---------------------------------------------------------------------------

@app.post(
    "/hitl-review",
    summary="Human-in-the-Loop Review Action",
    tags=["HITL"],
    response_model=HITLReviewResponse,
)
async def hitl_review(request: HITLReviewRequest):
    """
    Record a clinician's review action (approve / override / escalate) on a
    previously orchestrated decision.

    Every action is appended to the hash-chained audit trail, referencing
    the original orchestration audit_id.
    """
    from audit.audit_trail import log_decision

    if request.action.value == "OVERRIDE" and not request.override_reason:
        raise HTTPException(
            status_code=422,
            detail="override_reason is required when action is OVERRIDE.",
        )

    logger.info(
        "HITL review: action=%s actor=%s references=%s",
        request.action.value,
        request.actor,
        request.audit_id,
    )

    payload = {
        "action": request.action.value,
        "actor": request.actor,
        "references_audit_id": request.audit_id,
        "override_reason": request.override_reason,
        "notes": request.notes,
    }
    review_audit_id = log_decision(
        action=f"HITL_{request.action.value}",
        patient_id=request.patient_id,
        actor=request.actor,
        payload=payload,
    )

    return HITLReviewResponse(
        status="recorded",
        action=request.action.value,
        actor=request.actor,
        review_audit_id=review_audit_id,
        references_audit_id=request.audit_id,
    )


# ---------------------------------------------------------------------------
# Module 11 — Audit Trail Viewer
# ---------------------------------------------------------------------------

@app.get(
    "/audit-trail",
    summary="Tamper-Evident Audit Trail",
    tags=["Audit"],
    response_model=AuditTrailResponse,
)
async def audit_trail(
    limit: int = 100,
    action_filter: str | None = None,
    patient_id_filter: str | None = None,
):
    """
    Return the full audit trail, newest entries first.

    Includes a `chain_valid` flag proving the log has not been tampered with.

    Query params:
      - limit            : max entries to return (default 100)
      - action_filter    : e.g. "ESCALATION" to filter by action type
      - patient_id_filter: show only entries for a specific patient
    """
    from audit.audit_trail import get_audit_trail, verify_chain

    entries = get_audit_trail()  # newest first

    if action_filter:
        entries = [e for e in entries if e.get("action", "").upper() == action_filter.upper()]
    if patient_id_filter:
        entries = [e for e in entries if e.get("patient_id") == patient_id_filter]

    chain_valid, chain_message = verify_chain()

    logger.info(
        "Audit trail requested: total=%d returned=%d chain_valid=%s",
        len(entries),
        min(limit, len(entries)),
        chain_valid,
    )

    return AuditTrailResponse(
        total_entries=len(entries),
        chain_valid=chain_valid,
        chain_message=chain_message,
        entries=entries[:limit],
    )


# ---------------------------------------------------------------------------
# Module 12 — PDF Protocol Upload
# ---------------------------------------------------------------------------

@app.post(
    "/extract-protocol-pdf",
    summary="Extract Protocol Criteria from PDF",
    tags=["Protocol"],
    response_model=ProtocolExtractionResponse,
)
async def extract_protocol_pdf(file: UploadFile = File(...)):
    """
    Accept a PDF file upload, extract its text with pypdf, then run the same
    Groq / regex extraction pipeline as POST /extract-protocol.

    Content-Type: multipart/form-data  (field name: "file")
    """
    from protocol.parser import parse_protocol, parse_protocol_fallback, ProtocolParseError

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    logger.info("PDF upload: filename=%s content_type=%s", file.filename, file.content_type)

    # --- Extract text from PDF ---
    try:
        import io
        from pypdf import PdfReader

        raw_bytes = await file.read()
        reader = PdfReader(io.BytesIO(raw_bytes))
        pages_text = [page.extract_text() or "" for page in reader.pages]
        protocol_text = "\n".join(pages_text).strip()

        if not protocol_text:
            raise HTTPException(
                status_code=422,
                detail="Could not extract any text from the PDF. "
                       "Scanned/image-only PDFs are not supported.",
            )

        logger.info(
            "PDF text extracted: %d pages, %d characters",
            len(reader.pages),
            len(protocol_text),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("PDF read error: %s", e, exc_info=True)
        raise HTTPException(status_code=422, detail=f"PDF processing failed: {e}")

    # --- Run criteria extraction (same logic as /extract-protocol) ---
    try:
        if settings.groq_configured:
            criteria = parse_protocol(protocol_text)
        else:
            logger.warning("Groq not configured — using regex fallback parser for PDF.")
            criteria = parse_protocol_fallback(protocol_text)
    except ProtocolParseError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("Protocol extraction error (PDF): %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")

    return ProtocolExtractionResponse(
        inclusion=criteria.inclusion,
        exclusion=criteria.exclusion,
        confidence=criteria.confidence,
        raw_text_length=len(protocol_text),
    )


# ---------------------------------------------------------------------------
# Module 13 — Biomarker Spike / Data Agent
# ---------------------------------------------------------------------------

class AnalyzeDataRequest(BaseModel):
    """
    A time-ordered list of Observation values for a single biomarker.
    Each item: { date: str, value: float }
    """
    patient_id: str = Field(default="unknown")
    biomarker: str = Field(
        ...,
        description='Name of the biomarker, e.g. "hba1c", "glucose", "systolic_bp".',
        examples=["hba1c"],
    )
    observations: list[Dict[str, Any]] = Field(
        ...,
        min_length=1,
        description='List of {"date": "YYYY-MM-DD", "value": <float>} dicts, chronological order.',
        examples=[[{"date": "2025-01-01", "value": 6.8}, {"date": "2025-04-01", "value": 9.2}]],
    )
    spike_threshold_pct: float = Field(
        default=20.0,
        ge=1.0,
        le=200.0,
        description="Percentage rise from rolling baseline that counts as a spike (default 20%).",
    )


class AnalyzeDataResponse(BaseModel):
    patient_id: str
    biomarker: str
    biomarker_spike: bool
    spike_magnitude_pct: Optional[float] = Field(
        default=None,
        description="% change from baseline to peak if a spike was detected, else null.",
    )
    latest_value: Optional[float] = None
    baseline_value: Optional[float] = None
    trend: str = Field(
        description='"rising" | "falling" | "stable" | "insufficient_data"',
    )
    detail: str = Field(description="Human-readable summary of the finding.")
    n_observations: int


@app.post(
    "/analyze-data",
    summary="Biomarker Spike Detection (Data Agent)",
    tags=["DataAgent"],
    response_model=AnalyzeDataResponse,
)
async def analyze_data(request: AnalyzeDataRequest):
    """
    Data Agent — detects a biomarker spike from an Observation time-series.

    Algorithm:
      1. Sort observations chronologically.
      2. Compute baseline = mean of first 50% of readings.
      3. Latest value = most recent reading.
      4. Spike if latest_value > baseline * (1 + spike_threshold_pct/100).
      5. Trend = rising / falling / stable based on linear regression slope.

    This feeds the Day-4 escalation climax:
      biomarker_spike=True AND risk_level=HIGH → auto-escalate.

    Returns { biomarker_spike: bool, detail: str, ... }
    """
    import statistics

    obs = request.observations
    biomarker = request.biomarker
    threshold_pct = request.spike_threshold_pct

    # Sort by date string (ISO format sorts lexicographically correctly)
    try:
        sorted_obs = sorted(obs, key=lambda o: str(o.get("date", "")))
    except Exception:
        sorted_obs = obs

    values = []
    for o in sorted_obs:
        try:
            values.append(float(o["value"]))
        except (KeyError, TypeError, ValueError):
            pass  # skip malformed entries

    if len(values) < 2:
        return AnalyzeDataResponse(
            patient_id=request.patient_id,
            biomarker=biomarker,
            biomarker_spike=False,
            latest_value=values[0] if values else None,
            baseline_value=None,
            trend="insufficient_data",
            detail="Need at least 2 valid numeric observations to detect a spike.",
            n_observations=len(obs),
        )

    # Baseline = mean of first half (at least 1 value)
    half = max(1, len(values) // 2)
    baseline = statistics.mean(values[:half])
    latest = values[-1]

    # Spike detection
    spike_magnitude_pct: Optional[float] = None
    biomarker_spike = False
    if baseline > 0:
        change_pct = ((latest - baseline) / baseline) * 100
        if change_pct >= threshold_pct:
            biomarker_spike = True
            spike_magnitude_pct = round(change_pct, 1)

    # Trend via simple slope (first vs last)
    delta = values[-1] - values[0]
    spread = max(abs(v) for v in values) or 1
    rel_delta = delta / spread
    if rel_delta > 0.05:
        trend = "rising"
    elif rel_delta < -0.05:
        trend = "falling"
    else:
        trend = "stable"

    # Detail message
    if biomarker_spike:
        detail = (
            f"{biomarker.upper()} spike detected: latest value {latest:.2f} is "
            f"{spike_magnitude_pct:.1f}% above baseline {baseline:.2f}. "
            f"Trend: {trend}. Immediate review recommended."
        )
    else:
        detail = (
            f"No {biomarker.upper()} spike detected. "
            f"Latest value {latest:.2f} vs baseline {baseline:.2f} (threshold {threshold_pct:.0f}%). "
            f"Trend: {trend}."
        )

    logger.info(
        "Biomarker analysis: patient=%s biomarker=%s spike=%s trend=%s",
        request.patient_id, biomarker, biomarker_spike, trend,
    )

    return AnalyzeDataResponse(
        patient_id=request.patient_id,
        biomarker=biomarker,
        biomarker_spike=biomarker_spike,
        spike_magnitude_pct=spike_magnitude_pct,
        latest_value=round(latest, 4),
        baseline_value=round(baseline, 4),
        trend=trend,
        detail=detail,
        n_observations=len(obs),
    )


# ---------------------------------------------------------------------------
# Module 14 — Adherence Overlay (serve pre-computed JSON to BE)
# ---------------------------------------------------------------------------

@app.get(
    "/adherence-overlay",
    summary="Adherence Overlay Data",
    tags=["Adherence"],
    response_model=Dict[str, Any],
)
async def adherence_overlay(
    patient_id: str | None = None,
    status_filter: str | None = None,
):
    """
    Serve the pre-computed adherence overlay JSON generated by
    `adherence/adherence_overlay.py`.

    The Spring Boot backend calls this to:
      1. Get the `missed_visits` + `travel_distance_km` risk features for /predict-risk.
      2. Power the compliance-alerts dashboard.

    Query params:
      - patient_id    : return only the entry for this patient (within patients[]).
      - status_filter : one of on_track | at_risk | non_compliant — filter patients by status.

    If the overlay JSON has not been generated yet, returns a 404 with instructions.
    """
    from pathlib import Path

    overlay_path = Path(settings.base_dir) / "data" / "adherence_overlay.json"

    if not overlay_path.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "Adherence overlay not found. "
                "Run: python3 adherence/adherence_overlay.py  "
                "to generate aiml/data/adherence_overlay.json"
            ),
        )

    try:
        with open(overlay_path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read adherence overlay: {e}")

    # Apply filters
    patients = data.get("patients", [])

    if patient_id:
        patients = [p for p in patients if p.get("patient_id") == patient_id]
        if not patients:
            raise HTTPException(
                status_code=404,
                detail=f"Patient '{patient_id}' not found in adherence overlay.",
            )
        # Return the single patient dict directly (not wrapped)
        logger.info("Adherence overlay: single patient=%s", patient_id)
        return patients[0]

    if status_filter:
        valid_statuses = {"on_track", "at_risk", "non_compliant"}
        if status_filter not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"status_filter must be one of: {valid_statuses}",
            )
        patients = [p for p in patients if p.get("adherence_status") == status_filter]
        data = {**data, "patients": patients, "filtered_count": len(patients)}

    logger.info(
        "Adherence overlay served: %d patients (patient_id=%s status_filter=%s)",
        len(patients), patient_id, status_filter,
    )
    return data


# ===========================================================================
# DATA LAYER — Python now owns patients + trials (Java backend removed).
# The frontend talks directly to these endpoints.
# ===========================================================================

from schemas.data_schema import (
    TrialCreateRequest, TrialResponse,
    PatientSummary, PatientDetail, PatientListResponse,
    SelfEnrollRequest, SelfEnrollResponse,
    PatientOrchestrateRequest,
)
from schemas.patient_schema import CriteriaPayload, CohortPatient, CohortScreenRequest


# ---------------------------------------------------------------------------
# Trials  (Phase 0 — protocol setup)
# ---------------------------------------------------------------------------

@app.get("/trials", summary="List Trials", tags=["Trials"], response_model=list[TrialResponse])
async def list_trials_ep():
    from data_layer import trial_store
    return trial_store.list_trials()


@app.post("/trials", summary="Create Trial", tags=["Trials"], response_model=TrialResponse)
async def create_trial_ep(req: TrialCreateRequest):
    from data_layer import trial_store
    return trial_store.create_trial(req.name, req.protocol_text, req.inclusion, req.exclusion)


@app.get("/trials/{trial_id}", summary="Get Trial", tags=["Trials"], response_model=TrialResponse)
async def get_trial_ep(trial_id: str):
    from data_layer import trial_store
    trial = trial_store.get_trial(trial_id)
    if not trial:
        raise HTTPException(status_code=404, detail=f"Trial '{trial_id}' not found.")
    return trial


@app.post(
    "/trials/{trial_id}/protocol",
    summary="Upload Protocol PDF → extract + store criteria on the trial",
    tags=["Trials"],
    response_model=TrialResponse,
)
async def upload_trial_protocol(trial_id: str, file: UploadFile = File(...)):
    """
    Phase 0: drag in the protocol PDF. Extracts text (pypdf) → criteria (Groq/regex)
    → stores protocol_text + inclusion/exclusion on the trial → returns the trial.
    """
    from data_layer import trial_store
    from protocol.parser import parse_protocol, parse_protocol_fallback, ProtocolParseError

    if not trial_store.get_trial(trial_id):
        raise HTTPException(status_code=404, detail=f"Trial '{trial_id}' not found.")
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    try:
        import io
        from pypdf import PdfReader
        raw = await file.read()
        reader = PdfReader(io.BytesIO(raw))
        protocol_text = "\n".join((p.extract_text() or "") for p in reader.pages).strip()
        if not protocol_text:
            raise HTTPException(status_code=422, detail="No text extracted (scanned PDFs unsupported).")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"PDF processing failed: {e}")

    try:
        if settings.groq_configured:
            criteria = parse_protocol(protocol_text)
        else:
            criteria = parse_protocol_fallback(protocol_text)
    except ProtocolParseError as e:
        raise HTTPException(status_code=422, detail=str(e))

    updated = trial_store.update_criteria(
        trial_id, protocol_text, criteria.inclusion, criteria.exclusion
    )
    logger.info("Trial %s protocol stored: %d incl / %d excl",
                trial_id, len(criteria.inclusion), len(criteria.exclusion))
    return updated


# ---------------------------------------------------------------------------
# Patients  (Phase 1 — registry + self-enroll)
# ---------------------------------------------------------------------------

@app.get("/patients", summary="List Patients", tags=["Patients"], response_model=PatientListResponse)
async def list_patients_ep(limit: int = 500, source: str | None = None, enrolled: bool | None = None):
    from data_layer import registry
    patients = registry.list_patients(limit=limit, source=source, enrolled=enrolled)
    return PatientListResponse(total=len(patients), patients=patients)


@app.get("/patients/{patient_id}", summary="Get Patient", tags=["Patients"], response_model=PatientDetail)
async def get_patient_ep(patient_id: str):
    from data_layer import registry
    p = registry.get_patient(patient_id)
    if not p:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
    return p


@app.post("/patients", summary="Self-Enroll a Patient", tags=["Patients"], response_model=SelfEnrollResponse)
async def self_enroll_ep(req: SelfEnrollRequest):
    """
    Phase 1: patient recruitment form → store patient. If `trial_id` is supplied,
    auto-screen against that trial's criteria and cache the decision.
    """
    from data_layer import registry, trial_store
    from screening.screening_engine import screen_patient as _screen

    patient = registry.add_patient(req.model_dump())

    auto_screen = None
    if req.trial_id:
        trial = trial_store.get_trial(req.trial_id)
        if trial:
            criteria = {"inclusion": trial["inclusion"], "exclusion": trial["exclusion"]}
            result = _screen(criteria=criteria, patient=registry.screening_patient(patient["patient_id"]))
            decision = result.decision.value
            registry.set_screening_decision(patient["patient_id"], decision)
            patient["screening_decision"] = decision
            auto_screen = {
                "decision": decision,
                "confidence": result.confidence,
                "evidence": result.evidence,
            }
    return SelfEnrollResponse(patient=patient, auto_screen=auto_screen)


class EnrollDecisionRequest(BaseModel):
    trial_id: Optional[str] = None
    actor: str = "clinician"
    note: Optional[str] = None


@app.post("/patients/{patient_id}/enroll", summary="Clinician approves & enrolls a patient", tags=["Patients"])
async def enroll_patient_ep(patient_id: str, req: EnrollDecisionRequest):
    """
    Clinician confirmation: marks the patient enrolled (→ shows up under Active
    Monitoring) and writes an ENROLLMENT entry to the hash-chained audit trail.
    """
    from data_layer import registry
    from audit.audit_trail import log_decision

    p = registry.get_patient(patient_id)
    if not p:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")

    trial_id = req.trial_id or p.get("trial_id")
    registry.enroll_patient(patient_id, trial_id)

    audit_id = log_decision(
        action="ENROLLMENT",
        patient_id=patient_id,
        actor=req.actor,
        payload={"trial_id": trial_id, "status": "enrolled_for_monitoring",
                 "note": req.note, "patient_name": p.get("name")},
    )
    logger.info("Patient %s enrolled for monitoring by %s (audit %s)", patient_id, req.actor, audit_id)
    return {"status": "enrolled", "patient_id": patient_id, "trial_id": trial_id, "audit_id": audit_id}


# ---------------------------------------------------------------------------
# High-level screening + orchestrate (payloads assembled server-side from the DB)
# ---------------------------------------------------------------------------

@app.get(
    "/trials/{trial_id}/screen-cohort",
    summary="Tier 1 — bulk screen a trial's cohort (assembled from the DB)",
    tags=["Screening"],
    response_model=CohortScreenResponse,
)
async def screen_trial_cohort(trial_id: str, source: str | None = None):
    """
    Phase 2 (Tier 1): screen the whole cohort against a trial in ONE call. Builds
    each patient's screening dict + risk features from the SQLite registry, then
    runs the same rules+risk path as POST /screen-cohort (NO Groq, NO audit).
    """
    from data_layer import registry, trial_store

    trial = trial_store.get_trial(trial_id)
    if not trial:
        raise HTTPException(status_code=404, detail=f"Trial '{trial_id}' not found.")

    patients_summ = registry.list_patients(limit=10000, source=source)
    cohort = [
        CohortPatient(
            patient_id=p["patient_id"],
            name=p["name"],
            patient=registry.screening_patient(p["patient_id"]),
            patient_features=registry.feature_dict(p["patient_id"]) or {},
        )
        for p in patients_summ
    ]
    if not cohort:
        return CohortScreenResponse(total=0, summary={}, results=[])

    request = CohortScreenRequest(
        criteria=CriteriaPayload(inclusion=trial["inclusion"], exclusion=trial["exclusion"]),
        patients=cohort,
    )
    return await screen_cohort(request)


@app.post(
    "/patients/{patient_id}/orchestrate",
    summary="Tier 2 — full pipeline for one patient (assembled from the DB)",
    tags=["Orchestration"],
    response_model=OrchestrationResponse,
)
async def orchestrate_patient(patient_id: str, req: PatientOrchestrateRequest):
    """
    Phase 2 (Tier 2): full pipeline for a single patient. Pulls the patient's
    features + adherence from the registry and the trial's protocol_text from the
    trial store, then runs the existing /orchestrate pipeline.
    """
    from data_layer import registry, trial_store

    patient = registry.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
    trial = trial_store.get_trial(req.trial_id)
    if not trial:
        raise HTTPException(status_code=404, detail=f"Trial '{req.trial_id}' not found.")
    if not trial.get("protocol_text"):
        raise HTTPException(
            status_code=422,
            detail=f"Trial '{req.trial_id}' has no protocol_text yet. Upload a protocol PDF first.",
        )

    request = OrchestrationRequest(
        protocol_text=trial["protocol_text"],
        patient=registry.screening_patient(patient_id),
        patient_features=patient["features"],
        adherence_record=patient.get("adherence_record"),
        patient_id=patient_id,
        actor=req.actor,
        include_explanation=req.include_explanation,
    )
    return await orchestrate(request)


# ===========================================================================
# PHASE 3 — ACTIVE MONITORING (safety anomaly + efficacy + composite escalation)
# ===========================================================================

from schemas.monitoring_schema import (
    AnomalyRequest, EfficacyRequest, RecordVisitRequest,
    VisitMonitorResponse, VisitListResponse,
    VitalsTickRequest, VitalsTickResponse,
)


@app.post("/monitoring/anomaly", summary="Safety — Vital Anomaly Score", tags=["Monitoring"])
async def monitoring_anomaly(req: AnomalyRequest):
    """IsolationForest multivariate anomaly score for a single vitals reading."""
    from monitoring.vitals_anomaly import score_reading
    result = score_reading(req.vitals.as_dict())
    result["patient_id"] = req.patient_id
    return result


@app.post("/monitoring/efficacy", summary="Efficacy — Treatment Response", tags=["Monitoring"])
async def monitoring_efficacy(req: EfficacyRequest):
    """Compare a biomarker trajectory against the protocol-expected response."""
    from monitoring.efficacy import evaluate_efficacy
    return evaluate_efficacy(
        req.biomarker, req.series,
        adherence_rate=req.adherence_rate, visit_count=req.visit_count,
    )


@app.post(
    "/patients/{patient_id}/visit",
    summary="Record a monitoring visit (safety + efficacy + escalation + audit)",
    tags=["Monitoring"],
    response_model=VisitMonitorResponse,
)
async def record_visit(patient_id: str, req: RecordVisitRequest):
    """
    Phase 3 climax: record an enrolled patient's visit reading and run the full
    composite monitor (safety anomaly + efficacy trajectory + dropout risk +
    adherence) → monitoring_status + deterministic escalation → persisted + audited.
    """
    from data_layer import registry
    from monitoring.monitor import run_visit

    if not registry.get_patient(patient_id):
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")

    monitor = run_visit(
        patient_id=patient_id,
        trial_id=req.trial_id,
        visit_date=req.visit_date,
        vitals=req.vitals.as_dict(),
        biomarker=req.biomarker,
        actor=req.actor,
    )
    return VisitMonitorResponse(
        patient_id=patient_id,
        visit_id=monitor["visit_id"],
        visit_date=monitor["visit_date"],
        monitoring_status=monitor["monitoring_status"],
        safety=monitor["safety"],
        efficacy=monitor["efficacy"],
        dropout=monitor["dropout"],
        adherence_status=monitor.get("adherence_status"),
        escalation=monitor["escalation"],
        audit_id=monitor["audit_id"],
    )


class SimulateVisitRequest(BaseModel):
    """Body for one-click visit simulation — both fields optional."""
    trial_id: Optional[str] = None
    actor: str = "monitoring_agent"


@app.post(
    "/patients/{patient_id}/simulate-visit",
    summary="Simulate a trial-appropriate visit reading and run the monitor (one-click)",
    tags=["Monitoring"],
    response_model=VisitMonitorResponse,
)
async def simulate_visit_ep(patient_id: str, req: SimulateVisitRequest = SimulateVisitRequest()):
    """
    Generate a realistic next-visit reading for this enrolled patient (trial-aware,
    continues their trajectory, ~20% chance of a dangerous spike) and run the same
    composite monitor as a manual visit. No manual data entry needed.
    """
    from data_layer import registry, trial_store, visit_store
    from monitoring.monitor import run_visit
    from monitoring.simulate import simulate_visit

    patient = registry.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")

    trial_id = req.trial_id or patient.get("trial_id") or "default-t2dm"
    trial = trial_store.get_trial(trial_id)
    if not trial:
        raise HTTPException(status_code=404, detail=f"Trial '{trial_id}' not found.")

    prior = visit_store.list_visits(patient_id)
    vitals, visit_date, biomarker = simulate_visit(patient, trial, prior)

    monitor = run_visit(
        patient_id=patient_id, trial_id=trial_id, visit_date=visit_date,
        vitals=vitals, biomarker=biomarker, actor=req.actor,
    )
    return VisitMonitorResponse(
        patient_id=patient_id, visit_id=monitor["visit_id"], visit_date=monitor["visit_date"],
        monitoring_status=monitor["monitoring_status"], safety=monitor["safety"],
        efficacy=monitor["efficacy"], dropout=monitor["dropout"],
        adherence_status=monitor.get("adherence_status"), escalation=monitor["escalation"],
        audit_id=monitor["audit_id"],
    )


@app.post(
    "/patients/{patient_id}/vitals-tick",
    summary="Real-time vitals reading (live bedside stream) under a chosen scenario",
    tags=["Monitoring"],
    response_model=VitalsTickResponse,
)
async def vitals_tick(patient_id: str, req: VitalsTickRequest = VitalsTickRequest()):
    """
    One real-time reading from the simulated bedside machines. The frontend polls this
    every ~30s and also lets the operator force a scenario (normal / moderate / critical)
    to demo the safety model. Only CRITICAL readings are written to the audit trail.
    """
    from data_layer import registry
    from monitoring import realtime
    from audit.audit_trail import log_decision

    patient = registry.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")

    feats = patient.get("features") or {}
    diabetic = float(feats.get("hba1c") or 0) >= 6.3

    vitals = realtime.generate_reading(req.scenario, diabetic)
    status, vital_status, alerts = realtime.classify(vitals)
    is_anomaly = status == "critical"

    detail = ("All vitals within safe range." if status == "stable"
              else ("Borderline vitals - keep under watch: " + "; ".join(alerts)) if status == "watch"
              else "CRITICAL: " + "; ".join(alerts))

    escalated = False
    audit_id = None
    if status == "critical":
        escalated = True
        audit_id = log_decision(
            action="SAFETY_ALERT",
            patient_id=patient_id,
            actor=req.actor,
            payload={"source": "live_vitals", "vitals": vitals, "alerts": alerts,
                     "patient_name": patient.get("name")},
        )

    return VitalsTickResponse(
        patient_id=patient_id, timestamp=realtime.now_iso(), scenario=req.scenario,
        status=status, is_anomaly=is_anomaly, vitals=vitals, units=realtime.units(),
        vital_status=vital_status, alerts=alerts, detail=detail,
        escalated=escalated, audit_id=audit_id,
    )


@app.get(
    "/patients/{patient_id}/visits",
    summary="List a patient's recorded monitoring visits",
    tags=["Monitoring"],
    response_model=VisitListResponse,
)
async def list_visits_ep(patient_id: str):
    from data_layer import visit_store
    visits = visit_store.list_visits(patient_id)
    return VisitListResponse(patient_id=patient_id, total=len(visits), visits=visits)
