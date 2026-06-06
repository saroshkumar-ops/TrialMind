"""
utils/groq_client.py
--------------------
Reusable Groq API client with prompt helpers isolated from business logic.

Functions exposed:
  - extract_protocol_criteria(text) -> str  (raw JSON string)
  - generate_eligibility_explanation(criteria, patient, decision) -> str
  - generate_consent_summary(protocol_text) -> str
"""

import json
from typing import Optional

from groq import Groq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Client singleton (lazy-init so the app still starts without a valid key)
# ---------------------------------------------------------------------------
_client: Optional[Groq] = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        if not settings.groq_configured:
            raise RuntimeError(
                "GROQ_API_KEY is not configured. "
                "Set it in aiml/.env or as an environment variable."
            )
        _client = Groq(api_key=settings.groq_api_key)
        logger.info("Groq client initialised (model=%s)", settings.groq_model)
    return _client


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------
def _chat(system: str, user: str, temperature: float = 0.1, max_tokens: int = 1024) -> str:
    """Send a chat-completion request and return the content string."""
    client = _get_client()
    response = client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content.strip()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
def extract_protocol_criteria(protocol_text: str) -> str:
    """
    Extract inclusion/exclusion criteria from raw protocol text.

    Returns a JSON string of the form:
        {"inclusion": [...], "exclusion": [...], "confidence": 0.95}
    """
    system_prompt = (
        "You are a clinical trial protocol parser. "
        "Your ONLY task is to extract structured inclusion and exclusion criteria "
        "from the provided text. "
        "You MUST respond with valid JSON only — no markdown, no explanation.\n\n"
        "JSON schema (strictly follow it):\n"
        "{\n"
        '  "inclusion": ["<criterion>", ...],\n'
        '  "exclusion": ["<criterion>", ...],\n'
        '  "confidence": <float between 0.0 and 1.0>\n'
        "}\n\n"
        "Rules:\n"
        "- Each criterion must be a concise, standalone string.\n"
        "- If the text has no clear inclusion criteria, return an empty list.\n"
        "- If the text has no clear exclusion criteria, return an empty list.\n"
        "- confidence reflects how clearly the criteria were stated (0=ambiguous, 1=crystal clear).\n"
        "- Output ONLY the JSON object. Do NOT wrap in ```json blocks."
    )
    user_prompt = f"Protocol text:\n\n{protocol_text}"

    logger.info("Calling Groq for protocol extraction (text_length=%d)", len(protocol_text))
    raw = _chat(system_prompt, user_prompt, temperature=0.05, max_tokens=1024)
    logger.debug("Groq raw response: %s", raw[:300])

    # Strip accidental markdown fences if the model ignores instructions
    if raw.startswith("```"):
        raw = "\n".join(
            line for line in raw.splitlines()
            if not line.startswith("```")
        )
    return raw.strip()


def generate_eligibility_explanation(
    criteria: dict,
    patient: dict,
    decision: str,
) -> str:
    """
    Generate a human-readable explanation of why a patient received a particular
    eligibility decision. Returns a plain-text paragraph.
    """
    system_prompt = (
        "You are a clinical trial eligibility assessor. "
        "Given trial criteria and a patient profile, explain in 2–4 sentences "
        "why the patient was classified as they were. "
        "Be specific, reference actual values, and be suitable for a medical professional."
    )
    user_prompt = (
        f"Trial criteria:\n{json.dumps(criteria, indent=2)}\n\n"
        f"Patient data:\n{json.dumps(patient, indent=2)}\n\n"
        f"Decision: {decision}\n\n"
        "Explain this decision concisely."
    )
    logger.info("Generating eligibility explanation (decision=%s)", decision)
    return _chat(system_prompt, user_prompt, temperature=0.3, max_tokens=300)


def generate_consent_summary(protocol_text: str) -> str:
    """
    Generate a patient-friendly plain-language summary of a clinical trial protocol.
    Returns a short paragraph suitable for informed consent forms.
    """
    system_prompt = (
        "You are a medical writer specialising in patient communication. "
        "Summarise the following clinical trial protocol in plain language "
        "that a patient with no medical background can understand. "
        "Keep it under 150 words. Use simple sentences."
    )
    user_prompt = f"Protocol:\n\n{protocol_text}"
    logger.info("Generating consent summary (text_length=%d)", len(protocol_text))
    return _chat(system_prompt, user_prompt, temperature=0.4, max_tokens=300)
