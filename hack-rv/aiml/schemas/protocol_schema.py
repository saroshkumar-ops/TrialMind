"""
schemas/protocol_schema.py
--------------------------
Pydantic models for the /extract-protocol endpoint.
"""

from pydantic import BaseModel, Field, field_validator
from typing import List


class ProtocolExtractionRequest(BaseModel):
    """Input to POST /extract-protocol."""

    protocol_text: str = Field(
        ...,
        min_length=10,
        description="Raw clinical trial protocol text to be parsed.",
        examples=["Inclusion Criteria: Age 18-65, HbA1c 6.5-9.0\nExclusion Criteria: Kidney disease"],
    )


class ProtocolCriteria(BaseModel):
    """Structured output returned after protocol extraction."""

    inclusion: List[str] = Field(
        default_factory=list,
        description="List of inclusion criteria statements.",
    )
    exclusion: List[str] = Field(
        default_factory=list,
        description="List of exclusion criteria statements.",
    )
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Model confidence in the extraction quality (0–1).",
    )

    @field_validator("inclusion", "exclusion", mode="before")
    @classmethod
    def strip_empty_strings(cls, v):
        if isinstance(v, list):
            return [item.strip() for item in v if isinstance(item, str) and item.strip()]
        return v


class ProtocolExtractionResponse(BaseModel):
    """Full API response from /extract-protocol."""

    inclusion: List[str]
    exclusion: List[str]
    confidence: float
    raw_text_length: int = Field(description="Character length of the submitted protocol text.")
