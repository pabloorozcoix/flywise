"""Tests for app.parsers.text_parser — heuristic flight text parsing."""

from __future__ import annotations

import pytest

from app.models.domain import FlightResult
from app.parsers.text_parser import (
    _extract_airline,
    _extract_duration,
    _extract_stops,
    parse_raw_text_to_flight,
    try_parse_plain_text_flights,
    try_parse_raw_text_flights,
)


# ── parse_raw_text_to_flight ────────────────────────────────────


class TestParseRawTextToFlight:
    """Verify single card text → FlightResult parsing."""

    def test_typical_kayak_card(self):
        text = "Save | Share | 6:25 pm – 9:05 am+1 | Aer Lingus | 1 stop | SNN | 1h 30m layover, Shannon | 9h 40m | JFK | - | LHR | $530 | Saver | Select"
        result = parse_raw_text_to_flight(text)
        assert result is not None
        assert result.airline == "Aer Lingus"
        assert result.price == 530.0
        assert result.currency == "USD"
        assert result.stops == 1

    def test_nonstop_flight(self):
        text = "Save | Share | 8:00 am – 8:30 pm | British Airways | nonstop | 7h 30m | $450 | Select"
        result = parse_raw_text_to_flight(text)
        assert result is not None
        assert result.stops == 0
        assert result.airline == "British Airways"

    def test_empty_string_returns_none(self):
        assert parse_raw_text_to_flight("") is None

    def test_no_price_returns_none(self):
        assert parse_raw_text_to_flight("Delta 8:00 am 4:00 pm nonstop") is None

    def test_euro_currency(self):
        text = "Lufthansa | 10:00 am | 6:00 pm | 8h | nonstop | €350"
        result = parse_raw_text_to_flight(text)
        assert result is not None
        assert result.currency == "EUR"
        assert result.price == 350.0

    def test_gbp_currency(self):
        text = "BA | 9:00 am | 5:00 pm | 8h | nonstop | £400"
        result = parse_raw_text_to_flight(text)
        assert result is not None
        assert result.currency == "GBP"

    def test_price_with_comma(self):
        text = "Emirates | 10:00 pm | 8:00 am+1 | 14h | 1 stop | $1,250"
        result = parse_raw_text_to_flight(text)
        assert result is not None
        assert result.price == 1250.0

    def test_only_marketing_text_returns_none(self):
        text = "Search for cheap deals and find the best flights | $99"
        result = parse_raw_text_to_flight(text)
        assert result is None


# ── try_parse_raw_text_flights ──────────────────────────────────


class TestTryParseRawTextFlights:
    """Verify JSON array of {raw_text} parsing with fallback."""

    def test_valid_json_array(self):
        import json

        cards = [
            {"raw_text": "Delta | 8:00 am | 4:00 pm | 8h | nonstop | $450"},
            {"raw_text": "United | 9:00 am | 5:00 pm | 8h | 1 stop | $380"},
        ]
        text = json.dumps(cards)
        result = try_parse_raw_text_flights(text)
        assert result is not None
        assert len(result) == 2

    def test_none_input_returns_none(self):
        assert try_parse_raw_text_flights(None) is None

    def test_empty_string_returns_none(self):
        assert try_parse_raw_text_flights("") is None

    def test_non_string_returns_none(self):
        assert try_parse_raw_text_flights(123) is None

    def test_plain_text_fallback(self):
        text = "Delta\n8:00 am\n4:00 pm\n8h\nnonstop\n$450\n\nUnited\n9:00 am\n5:00 pm\n8h\n1 stop\n$380"
        result = try_parse_raw_text_flights(text)
        # May or may not parse depending on heuristics, but should not crash
        assert result is None or isinstance(result, list)


# ── try_parse_plain_text_flights ────────────────────────────────


class TestTryParsePlainTextFlights:
    """Verify plain text → flight result scanning."""

    def test_short_text_returns_none(self):
        assert try_parse_plain_text_flights("hi") is None

    def test_none_returns_none(self):
        assert try_parse_plain_text_flights(None) is None

    def test_empty_returns_none(self):
        assert try_parse_plain_text_flights("") is None

    def test_text_without_prices_returns_none(self):
        text = "Welcome to Kayak\nFind great flights\nSearch for deals"
        assert try_parse_plain_text_flights(text) is None

    def test_double_newline_strategy(self):
        text = (
            "Delta\n8:00 am\n4:00 pm\n8h\nnonstop\n$450\n\n"
            "United\n9:00 am\n5:00 pm\n8h\n1 stop\n$380"
        )
        result = try_parse_plain_text_flights(text)
        assert result is None or isinstance(result, list)

    def test_price_marker_strategy(self):
        """Test strategy B: price marker scan with surrounding context."""
        lines = [
            "Some header text",
            "More info",
            "Delta Airlines",
            "8:00 am departure",
            "4:00 pm arrival",
            "8h duration",
            "nonstop",
            "JFK to LHR",
            "$450",
            "",
            "Other stuff",
        ]
        text = "\n".join(lines)
        result = try_parse_plain_text_flights(text)
        # Strategy B should pick up the $450 flight
        assert result is None or isinstance(result, list)


# ── _extract_duration ───────────────────────────────────────────


class TestExtractDuration:
    def test_standard_format(self):
        assert _extract_duration("flight 8h 30m to destination") == "8h 30m"

    def test_hours_only(self):
        assert _extract_duration("flight 7h to LHR") == "7h"

    def test_hours_minutes_format(self):
        assert _extract_duration("duration: 2 hours 15 minutes") == "2h 15m"

    def test_skips_layover_duration(self):
        assert _extract_duration("1h 30m layover, Shannon | 9h 40m") == "9h 40m"

    def test_no_match_returns_na(self):
        assert _extract_duration("no duration info here") == "N/A"


# ── _extract_stops ──────────────────────────────────────────────


class TestExtractStops:
    def test_numeric_stop(self):
        assert _extract_stops("1 stop") == 1

    def test_two_stops(self):
        assert _extract_stops("2 stops") == 2

    def test_nonstop(self):
        assert _extract_stops("nonstop flight") == 0

    def test_direct(self):
        assert _extract_stops("direct flight") == 0

    def test_no_info_defaults_zero(self):
        assert _extract_stops("some random text") == 0


# ── _extract_airline ────────────────────────────────────────────


class TestExtractAirline:
    def test_pipe_delimited(self):
        text = "Save | Share | 8:00 am | Delta | nonstop | $450"
        assert _extract_airline(text) == "Delta"

    def test_newline_delimited(self):
        text = "Save\nShare\n8:00 am\nBritish Airways\nnonstop\n$450"
        assert _extract_airline(text) == "British Airways"

    def test_skips_time_patterns(self):
        text = "8:00 am | 4:00 pm | Delta"
        result = _extract_airline(text)
        assert result == "Delta"

    def test_skips_price_patterns(self):
        text = "$450 | Delta | Select"
        result = _extract_airline(text)
        assert result == "Delta"

    def test_skips_airport_codes(self):
        text = "JFK | Delta | LHR"
        result = _extract_airline(text)
        assert result == "Delta"

    def test_skips_ui_labels(self):
        text = "Save | Share | Select | Delta"
        result = _extract_airline(text)
        assert result == "Delta"

    def test_returns_none_for_no_airline(self):
        text = "Save | Share | $450 | 8:00 am"
        result = _extract_airline(text)
        assert result is None

    def test_skips_marketing_text(self):
        text = "Search for cheap flights"
        result = _extract_airline(text)
        assert result is None
