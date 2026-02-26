"""Tests for app.models.enums — CabinClass and SearchStatusValue."""

from __future__ import annotations

from app.models.enums import CabinClass, SearchStatusValue


class TestCabinClass:
    """Verify CabinClass enum values and string serialization."""

    def test_economy_value(self):
        assert CabinClass.ECONOMY == "economy"
        assert CabinClass.ECONOMY.value == "economy"

    def test_premium_economy_value(self):
        assert CabinClass.PREMIUM_ECONOMY == "premium_economy"

    def test_business_value(self):
        assert CabinClass.BUSINESS == "business"

    def test_first_value(self):
        assert CabinClass.FIRST == "first"

    def test_is_str_subclass(self):
        assert isinstance(CabinClass.ECONOMY, str)

    def test_all_members_count(self):
        assert len(CabinClass) == 4


class TestSearchStatusValue:
    """Verify SearchStatusValue enum values."""

    def test_running_value(self):
        assert SearchStatusValue.RUNNING == "running"

    def test_completed_value(self):
        assert SearchStatusValue.COMPLETED == "completed"

    def test_failed_value(self):
        assert SearchStatusValue.FAILED == "failed"

    def test_cancelled_value(self):
        assert SearchStatusValue.CANCELLED == "cancelled"

    def test_is_str_subclass(self):
        assert isinstance(SearchStatusValue.RUNNING, str)

    def test_all_members_count(self):
        assert len(SearchStatusValue) == 4
