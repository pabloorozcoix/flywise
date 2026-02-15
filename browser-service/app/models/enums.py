"""Enumeration types for the flight search domain."""

from enum import Enum


class CabinClass(str, Enum):
    """Aircraft cabin class for flight search requests."""

    ECONOMY = "economy"
    PREMIUM_ECONOMY = "premium_economy"
    BUSINESS = "business"
    FIRST = "first"


class SearchStatusValue(str, Enum):
    """Possible states of a flight search lifecycle."""

    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
