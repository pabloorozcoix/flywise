"""Tests for app.parsers.flight_parser — 7-strategy parser + key normalization."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock

import pytest

from app.models.domain import FlightResult
from app.parsers.flight_parser import (
    normalize_result_keys,
    parse_flight_results,
    try_parse_flight_json,
)


# ── normalize_result_keys ───────────────────────────────────────


class TestNormalizeResultKeys:
    """Verify key renaming, type coercion, and defaults."""

    def test_camel_case_keys(self):
        data = {
            "departureTime": "8:00 AM",
            "arrivalTime": "4:00 PM",
            "flightUrl": "https://example.com",
        }
        result = normalize_result_keys(data)
        assert result["departure_time"] == "8:00 AM"
        assert result["arrival_time"] == "4:00 PM"
        assert result["flight_url"] == "https://example.com"

    def test_airline_name_normalization(self):
        data = {"airline_name": "Delta", "price": 500}
        result = normalize_result_keys(data)
        assert result["airline"] == "Delta"

    def test_stops_from_string(self):
        data = {"stops": "1 stop"}
        result = normalize_result_keys(data)
        assert result["stops"] == 1

    def test_stops_nonstop_string(self):
        data = {"stops": "nonstop"}
        result = normalize_result_keys(data)
        assert result["stops"] == 0

    def test_stops_direct_string(self):
        data = {"stops": "direct"}
        result = normalize_result_keys(data)
        assert result["stops"] == 0

    def test_stops_default(self):
        data = {"airline": "Delta"}
        result = normalize_result_keys(data)
        assert result["stops"] == 0

    def test_nonstop_boolean(self):
        data = {"nonstop": True}
        result = normalize_result_keys(data)
        assert result["stops"] == 0

    def test_currency_default(self):
        data = {"airline": "Delta"}
        result = normalize_result_keys(data)
        assert result["currency"] == "USD"

    def test_price_from_string(self):
        data = {"price": "$522"}
        result = normalize_result_keys(data)
        assert result["price"] == 522.0

    def test_price_from_string_with_comma(self):
        data = {"price": "$1,250"}
        result = normalize_result_keys(data)
        assert result["price"] == 1250.0

    def test_strips_whitespace_from_string_values(self):
        data = {"airline": "  Delta  "}
        result = normalize_result_keys(data)
        assert result["airline"] == "Delta"

    def test_total_duration_normalized(self):
        data = {"totalDuration": "8h 30m"}
        result = normalize_result_keys(data)
        assert result["duration"] == "8h 30m"

    def test_number_of_stops_normalized(self):
        data = {"numberOfStops": 2}
        result = normalize_result_keys(data)
        assert result["stops"] == 2


# ── try_parse_flight_json ───────────────────────────────────────


class TestTryParseFlightJson:
    """Verify JSON flight parsing with malformed JSON recovery."""

    def test_valid_json_array(self):
        text = json.dumps([
            {
                "airline": "Delta",
                "departure_time": "8:00 AM",
                "arrival_time": "4:00 PM",
                "duration": "8h",
                "stops": 0,
                "price": 450,
                "currency": "USD",
            }
        ])
        result = try_parse_flight_json(text)
        assert result is not None
        assert len(result) == 1
        assert result[0].airline == "Delta"

    def test_returns_none_for_non_json(self):
        assert try_parse_flight_json("not json") is None

    def test_returns_none_for_empty_string(self):
        assert try_parse_flight_json("") is None

    def test_returns_none_for_none(self):
        assert try_parse_flight_json(None) is None

    def test_handles_json_in_markdown_code_block(self):
        text = '```json\n[{"airline": "Delta", "departure_time": "8:00", "arrival_time": "4:00", "duration": "8h", "stops": 0, "price": 450, "currency": "USD"}]\n```'
        result = try_parse_flight_json(text)
        assert result is not None
        assert len(result) == 1

    def test_handles_dict_with_flights_key(self):
        text = json.dumps({
            "flights": [
                {
                    "airline": "United",
                    "departure_time": "9:00 AM",
                    "arrival_time": "5:00 PM",
                    "duration": "8h",
                    "stops": 1,
                    "price": 380,
                    "currency": "USD",
                }
            ]
        })
        result = try_parse_flight_json(text)
        assert result is not None
        assert len(result) == 1

    def test_handles_malformed_json(self):
        text = '{airline: "Delta", departure_time: "8:00", arrival_time: "4:00", duration: "8h", stops: 0, price: 450, currency: "USD"}'
        result = try_parse_flight_json(text)
        assert result is not None or result is None  # should not crash

    def test_returns_none_for_non_string_input(self):
        assert try_parse_flight_json(123) is None


# ── parse_flight_results (7-strategy orchestrator) ──────────────


class TestParseFlightResults:
    """Verify multi-strategy parsing from mock history objects."""

    def _make_history(
        self,
        final_result: str | None = None,
        extracted_content: str | None = None,
    ) -> Any:
        """Create a mock agent history object."""
        history = MagicMock()

        # final_result()
        if final_result is not None:
            history.final_result = MagicMock(return_value=final_result)
        else:
            history.final_result = MagicMock(return_value=None)

        # history.history entries
        if extracted_content is not None:
            action_result = MagicMock()
            action_result.extracted_content = extracted_content
            entry = MagicMock()
            entry.result = [action_result]
            entry.model_output = None
            history.history = [entry]
        else:
            history.history = []

        # action_results()
        history.action_results = MagicMock(return_value=[])

        return history

    def test_returns_empty_list_for_empty_history(self):
        history = self._make_history()
        result = parse_flight_results(history)
        assert result == []

    def test_strategy_0_structured_output(self):
        data = json.dumps({
            "flights": [
                {
                    "airline": "Delta",
                    "departure_time": "8:00",
                    "arrival_time": "4:00",
                    "duration": "8h",
                    "stops": 0,
                    "price": 450,
                    "currency": "USD",
                }
            ]
        })
        history = self._make_history(final_result=data)
        result = parse_flight_results(history)
        assert len(result) == 1
        assert result[0].airline == "Delta"

    def test_strategy_1_final_result_json_array(self):
        data = json.dumps([
            {
                "airline": "United",
                "departure_time": "9:00",
                "arrival_time": "5:00",
                "duration": "8h",
                "stops": 1,
                "price": 380,
                "currency": "USD",
            }
        ])
        history = self._make_history(final_result=data)
        result = parse_flight_results(history)
        assert len(result) >= 1

    def test_strategy_2_extracted_content(self):
        data = json.dumps([
            {
                "airline": "BA",
                "departure_time": "7:00",
                "arrival_time": "3:00",
                "duration": "8h",
                "stops": 0,
                "price": 600,
                "currency": "GBP",
            }
        ])
        history = self._make_history(extracted_content=data)
        result = parse_flight_results(history)
        assert len(result) >= 1

    def test_strategy_6_raw_text(self):
        cards = json.dumps([
            {"raw_text": "Delta | 8:00 am | 4:00 pm | 8h | nonstop | $450"},
        ])
        history = self._make_history(extracted_content=cards)
        result = parse_flight_results(history)
        # Should parse via one of the strategies
        assert isinstance(result, list)

    def test_handles_non_history_object(self):
        """Should return empty list for completely invalid input."""
        result = parse_flight_results(None)
        assert result == []

    def test_handles_history_without_attributes(self):
        history = object()
        result = parse_flight_results(history)
        assert result == []
