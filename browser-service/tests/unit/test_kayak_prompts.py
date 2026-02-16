"""Tests for app.prompts.kayak — URL builder and prompt templates."""

from __future__ import annotations

from datetime import date

import pytest

from app.models.enums import CabinClass
from app.prompts.kayak import build_flight_search_prompt, build_kayak_url


# ── build_kayak_url ─────────────────────────────────────────────


class TestBuildKayakUrl:
    """Verify Kayak URL construction for all parameter combinations."""

    def test_basic_one_way(self):
        url = build_kayak_url("JFK", "LHR", date(2026, 3, 15))
        assert "kayak.com/flights/JFK-LHR/2026-03-15" in url
        assert "sort=price_a" in url
        assert "cabin=e" in url

    def test_round_trip(self):
        url = build_kayak_url(
            "JFK", "LHR", date(2026, 3, 15), return_date=date(2026, 3, 22)
        )
        assert "2026-03-15/2026-03-22" in url

    def test_business_class(self):
        url = build_kayak_url(
            "SFO", "NRT", date(2026, 4, 1), cabin_class=CabinClass.BUSINESS
        )
        assert "cabin=b" in url

    def test_first_class(self):
        url = build_kayak_url(
            "LAX", "CDG", date(2026, 5, 1), cabin_class=CabinClass.FIRST
        )
        assert "cabin=f" in url

    def test_premium_economy(self):
        url = build_kayak_url(
            "ORD", "FRA", date(2026, 6, 1), cabin_class=CabinClass.PREMIUM_ECONOMY
        )
        assert "cabin=p" in url

    def test_economy_default(self):
        url = build_kayak_url("JFK", "LHR", date(2026, 3, 15))
        assert "cabin=e" in url

    def test_direct_only(self):
        url = build_kayak_url(
            "JFK", "LHR", date(2026, 3, 15), direct_only=True
        )
        assert "stops=0" in url

    def test_not_direct_only(self):
        url = build_kayak_url(
            "JFK", "LHR", date(2026, 3, 15), direct_only=False
        )
        assert "stops=0" not in url

    def test_uppercases_airports(self):
        url = build_kayak_url("jfk", "lhr", date(2026, 3, 15))
        assert "JFK-LHR" in url

    def test_full_url_format(self):
        url = build_kayak_url(
            "jfk",
            "lhr",
            date(2026, 3, 15),
            return_date=date(2026, 3, 22),
            cabin_class=CabinClass.BUSINESS,
            direct_only=True,
        )
        assert url.startswith("https://www.kayak.com/flights/")
        assert "JFK-LHR" in url
        assert "2026-03-15/2026-03-22" in url
        assert "cabin=b" in url
        assert "stops=0" in url


# ── build_flight_search_prompt ──────────────────────────────────


class TestBuildFlightSearchPrompt:
    """Verify agent prompt template content."""

    def test_contains_route(self):
        prompt = build_flight_search_prompt("JFK", "LHR", date(2026, 3, 15))
        assert "JFK" in prompt
        assert "LHR" in prompt

    def test_contains_date(self):
        prompt = build_flight_search_prompt("JFK", "LHR", date(2026, 3, 15))
        assert "2026-03-15" in prompt

    def test_contains_cabin_display(self):
        prompt = build_flight_search_prompt(
            "JFK", "LHR", date(2026, 3, 15), cabin_class=CabinClass.BUSINESS
        )
        assert "Business" in prompt

    def test_contains_direct_only_text(self):
        prompt = build_flight_search_prompt(
            "JFK", "LHR", date(2026, 3, 15), direct_only=True
        )
        assert "Nonstop only" in prompt

    def test_contains_any_stops_text(self):
        prompt = build_flight_search_prompt(
            "JFK", "LHR", date(2026, 3, 15), direct_only=False
        )
        assert "Any number of stops" in prompt

    def test_return_date_in_prompt(self):
        prompt = build_flight_search_prompt(
            "JFK", "LHR", date(2026, 3, 15), return_date=date(2026, 3, 22)
        )
        assert "2026-03-22" in prompt

    def test_contains_kayak_url(self):
        prompt = build_flight_search_prompt("JFK", "LHR", date(2026, 3, 15))
        assert "kayak.com" in prompt

    def test_is_nonempty_string(self):
        prompt = build_flight_search_prompt("JFK", "LHR", date(2026, 3, 15))
        assert isinstance(prompt, str)
        assert len(prompt) > 100

    def test_contains_extraction_instructions(self):
        prompt = build_flight_search_prompt("JFK", "LHR", date(2026, 3, 15))
        assert "evaluate" in prompt.lower()
        assert "extract" in prompt.lower()
