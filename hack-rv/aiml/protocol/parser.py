"""
protocol/parser.py
------------------
Module 1 — Protocol Criteria Extraction.

Calls Groq LLM to extract structured inclusion/exclusion criteria from
unstructured clinical trial protocol text.

Retry logic:  Up to 3 attempts if the LLM returns invalid JSON.
Validation:   Output is validated against the ProtocolCriteria Pydantic model.
"""

import json
from typing import Optional

from pydantic import ValidationError

from schemas.protocol_schema import ProtocolCriteria
from utils.groq_client import extract_protocol_criteria
from utils.logger import get_logger

logger = get_logger(__name__)


class ProtocolParseError(Exception):
    """Raised when the LLM response cannot be parsed into valid criteria."""


def parse_protocol(protocol_text: str) -> ProtocolCriteria:
    """
    Extract criteria from raw protocol text using the Groq LLM.

    Args:
        protocol_text: Unstructured clinical trial protocol document.

    Returns:
        ProtocolCriteria with inclusion, exclusion lists and confidence score.

    Raises:
        ProtocolParseError: If all retry attempts fail to produce valid JSON.
        RuntimeError: If Groq is not configured.
    """
    last_error: Optional[Exception] = None

    for attempt in range(1, 4):  # Up to 3 attempts (tenacity handles retries inside groq_client)
        try:
            logger.info("Protocol extraction attempt %d/3", attempt)
            raw_json = extract_protocol_criteria(protocol_text)

            # Attempt to parse
            data = json.loads(raw_json)

            # Validate with Pydantic
            criteria = ProtocolCriteria.model_validate(data)
            logger.info(
                "Protocol extracted: %d inclusion, %d exclusion criteria (confidence=%.2f)",
                len(criteria.inclusion),
                len(criteria.exclusion),
                criteria.confidence,
            )
            return criteria

        except json.JSONDecodeError as e:
            logger.warning("Attempt %d: JSON decode failed: %s", attempt, e)
            last_error = e
        except ValidationError as e:
            logger.warning("Attempt %d: Pydantic validation failed: %s", attempt, e)
            last_error = e
        except RuntimeError:
            # Groq not configured — propagate immediately
            raise
        except Exception as e:
            logger.error("Attempt %d: Unexpected error: %s", attempt, e)
            last_error = e

    raise ProtocolParseError(
        f"Failed to extract valid protocol criteria after 3 attempts. "
        f"Last error: {last_error}"
    )


def parse_protocol_fallback(protocol_text: str) -> ProtocolCriteria:
    """
    Regex-based fallback parser for when Groq is unavailable.

    Uses simple pattern matching to extract criteria from common protocol formats.
    """
    import re

    inclusion: list[str] = []
    exclusion: list[str] = []

    # Normalise line endings
    text = protocol_text.replace("\r\n", "\n").replace("\r", "\n")

    # Split into sections
    sections = re.split(r"(?i)(inclusion criteria?|exclusion criteria?)\s*:?", text)

    current_section = None
    for part in sections:
        part_stripped = part.strip()
        if re.match(r"(?i)inclusion criteria?", part_stripped):
            current_section = "inclusion"
        elif re.match(r"(?i)exclusion criteria?", part_stripped):
            current_section = "exclusion"
        elif current_section and part_stripped:
            # Extract bullet items
            items = re.split(r"\n+", part_stripped)
            for item in items:
                item = re.sub(r"^[\-\*•\d\.\)]+\s*", "", item).strip()
                if item and len(item) > 3:
                    if current_section == "inclusion":
                        inclusion.append(item)
                    else:
                        exclusion.append(item)
            current_section = None  # Reset after capturing section

    confidence = 0.6 if (inclusion or exclusion) else 0.2

    logger.info(
        "Fallback parser: %d inclusion, %d exclusion (confidence=%.2f)",
        len(inclusion),
        len(exclusion),
        confidence,
    )
    return ProtocolCriteria(inclusion=inclusion, exclusion=exclusion, confidence=confidence)
