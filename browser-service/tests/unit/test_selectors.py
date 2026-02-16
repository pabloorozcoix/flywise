"""Tests for app.constants.selectors — EXTRACTION_JS constant."""

from __future__ import annotations

from app.constants.selectors import EXTRACTION_JS


class TestExtractionJs:
    """Verify the JavaScript extraction snippet."""

    def test_is_string(self):
        assert isinstance(EXTRACTION_JS, str)

    def test_not_empty(self):
        assert len(EXTRACTION_JS) > 50

    def test_is_iife(self):
        stripped = EXTRACTION_JS.strip()
        assert stripped.startswith("(")
        assert stripped.endswith("}")

    def test_queries_nrc6_wrapper(self):
        assert ".nrc6-wrapper" in EXTRACTION_JS

    def test_queries_nrc6_inner(self):
        assert ".nrc6-inner" in EXTRACTION_JS

    def test_queries_aria_label_flight(self):
        assert 'aria-label*="Flight"' in EXTRACTION_JS

    def test_returns_json_stringify(self):
        assert "JSON.stringify" in EXTRACTION_JS

    def test_has_fallback_to_body(self):
        assert "document.body" in EXTRACTION_JS

    def test_limits_cards_to_20(self):
        assert "20" in EXTRACTION_JS

    def test_limits_text_to_15000(self):
        assert "15000" in EXTRACTION_JS

    def test_checks_price_pattern(self):
        assert "$" in EXTRACTION_JS

    def test_checks_time_pattern(self):
        assert "\\d+:\\d+" in EXTRACTION_JS
