"""Tests for app.parsers.json_fixer — malformed JSON repair utilities."""

from __future__ import annotations

import pytest

from app.parsers.json_fixer import (
    _try_parse_block,
    extract_individual_objects,
    fix_malformed_json,
)


# ── fix_malformed_json ──────────────────────────────────────────


class TestFixMalformedJson:
    """Verify all regex-based JSON repair transformations."""

    def test_smart_double_quotes(self):
        result = fix_malformed_json('{"key": \u201cvalue\u201d}')
        assert "\u201c" not in result
        assert "\u201d" not in result
        assert '"value"' in result

    def test_smart_single_quotes(self):
        result = fix_malformed_json("{\u2018key\u2019: \u2018value\u2019}")
        assert "\u2018" not in result
        assert "\u2019" not in result

    def test_german_low_quote(self):
        result = fix_malformed_json('{\u201ekey\u201c: \u201evalue\u201c}')
        assert "\u201e" not in result

    def test_trailing_comma_before_brace(self):
        result = fix_malformed_json('{"a": 1,}')
        assert result.rstrip() == '{"a": 1}'

    def test_trailing_comma_before_bracket(self):
        result = fix_malformed_json('[1, 2, 3,]')
        assert result.rstrip() == '[1, 2, 3]'

    def test_unquoted_keys(self):
        result = fix_malformed_json('{airline: "Delta"}')
        assert '"airline"' in result

    def test_fix_spaces_in_key_names(self):
        result = fix_malformed_json('{"arrival _time": "8:00"}')
        assert '"arrival_time"' in result

    def test_fix_semicolons_in_values(self):
        result = fix_malformed_json('{"time": "8;25am"}')
        assert "8:25am" in result

    def test_strip_trailing_spaces_in_values(self):
        result = fix_malformed_json('{"name": "Delta   "}')
        assert '"Delta"' in result

    def test_removes_truncated_placeholder(self):
        result = fix_malformed_json('[{"a":1}, {... (remaining 5 flights) ...}]')
        assert "..." not in result

    def test_unquoted_string_values(self):
        result = fix_malformed_json('{"airline": Delta}')
        assert '"Delta"' in result

    def test_preserves_null(self):
        result = fix_malformed_json('{"url": null}')
        assert "null" in result

    def test_preserves_numbers(self):
        result = fix_malformed_json('{"price": 522}')
        assert "522" in result

    def test_preserves_boolean(self):
        result = fix_malformed_json('{"direct": true}')
        assert "true" in result

    def test_combines_multiple_fixes(self):
        """Test multiple issues in one string."""
        text = '{airline: \u201cDelta\u201d, price: 522,}'
        result = fix_malformed_json(text)
        assert "\u201c" not in result
        assert '"airline"' in result


# ── extract_individual_objects ──────────────────────────────────


class TestExtractIndividualObjects:
    """Verify brace-depth walking object extraction."""

    def test_single_valid_object(self):
        text = '{"airline": "Delta", "price": 500}'
        result = extract_individual_objects(text)
        assert result is not None
        assert len(result) == 1
        assert result[0]["airline"] == "Delta"

    def test_multiple_objects(self):
        text = '{"airline": "Delta", "price": 500} {"airline": "United", "price": 600}'
        result = extract_individual_objects(text)
        assert result is not None
        assert len(result) == 2

    def test_returns_none_for_no_objects(self):
        result = extract_individual_objects("no json here")
        assert result is None

    def test_skips_non_flight_objects(self):
        text = '{"foo": "bar"} {"airline": "Delta", "price": 500}'
        result = extract_individual_objects(text)
        assert result is not None
        assert len(result) == 1
        assert result[0]["airline"] == "Delta"

    def test_handles_nested_braces(self):
        text = '{"airline": "Delta", "price": 500, "meta": {"source": "kayak"}}'
        result = extract_individual_objects(text)
        assert result is not None
        assert len(result) == 1

    def test_returns_none_for_empty_string(self):
        result = extract_individual_objects("")
        assert result is None


# ── _try_parse_block ────────────────────────────────────────────


class TestTryParseBlock:
    """Verify single block parser with flight relevance filter."""

    def test_valid_flight_block(self):
        block = '{"airline": "Delta", "price": 500}'
        result = _try_parse_block(block)
        assert result is not None
        assert result["airline"] == "Delta"

    def test_non_flight_block_returns_none(self):
        block = '{"foo": "bar", "baz": 123}'
        result = _try_parse_block(block)
        assert result is None

    def test_malformed_block_with_fix(self):
        block = '{airline: "Delta", price: 500}'
        result = _try_parse_block(block)
        assert result is not None
        assert result["airline"] == "Delta"

    def test_completely_invalid_returns_none(self):
        result = _try_parse_block("not json at all")
        assert result is None
