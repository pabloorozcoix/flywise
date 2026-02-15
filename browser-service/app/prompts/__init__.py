"""Agent prompt templates for flight search."""

from app.prompts.extraction import build_extraction_prompt
from app.prompts.kayak import build_flight_search_prompt, build_kayak_url

__all__ = [
    "build_extraction_prompt",
    "build_flight_search_prompt",
    "build_kayak_url",
]
