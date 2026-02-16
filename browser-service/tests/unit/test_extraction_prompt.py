"""Tests for app.prompts.extraction — extraction prompt template."""

from __future__ import annotations

from app.prompts.extraction import build_extraction_prompt


class TestBuildExtractionPrompt:
    """Verify the extraction prompt contains required elements."""

    def test_returns_string(self):
        prompt = build_extraction_prompt()
        assert isinstance(prompt, str)

    def test_not_empty(self):
        prompt = build_extraction_prompt()
        assert len(prompt) > 50

    def test_mentions_json(self):
        prompt = build_extraction_prompt()
        assert "JSON" in prompt

    def test_mentions_airline(self):
        prompt = build_extraction_prompt()
        assert "airline" in prompt

    def test_mentions_price(self):
        prompt = build_extraction_prompt()
        assert "price" in prompt

    def test_mentions_departure_time(self):
        prompt = build_extraction_prompt()
        assert "departure_time" in prompt

    def test_mentions_arrival_time(self):
        prompt = build_extraction_prompt()
        assert "arrival_time" in prompt

    def test_mentions_duration(self):
        prompt = build_extraction_prompt()
        assert "duration" in prompt

    def test_mentions_stops(self):
        prompt = build_extraction_prompt()
        assert "stops" in prompt

    def test_mentions_currency(self):
        prompt = build_extraction_prompt()
        assert "USD" in prompt
