"""Heuristic parsers for extracting flight data from raw text.

These parsers handle two formats:

1. **Pipe-delimited card text** — produced by the JavaScript extraction
   (each Kayak flight card's ``innerText`` joined with ``|``).
2. **Plain page text** — the visible body text of the results page,
   scanned for price + time patterns as a last resort.
"""

from __future__ import annotations

import json
import re

from app.logger import get_logger
from app.models.domain import FlightResult

logger = get_logger("parsers.text")

# ── Known non-airline tokens to skip ────────────────────────────

_SKIP_PREFIXES = re.compile(
    r"^("
    r"Show more|Sponsored|Ad|round trip|one way|Track prices?"
    r"|Separate tickets|Self transfer|Checked bag|Carry-on"
    r"|Save|Share|Select|Saver|Basic|Main|Comfort|View Deal"
    r"|Go to|Book|Details|Price"
    r")\b",
    re.IGNORECASE,
)

_MARKETING_WORDS = re.compile(
    r"\b(search|compare|find|cheap|deal|site|book now|travel"
    r"|hundred|click|browse|explore)\b",
    re.IGNORECASE,
)


# ── Public API ──────────────────────────────────────────────────


def parse_raw_text_to_flight(raw_text: str) -> FlightResult | None:
    """Parse a single raw text blob into a :class:`FlightResult`.

    The input is typically a pipe-delimited string from a Kayak flight
    card's ``innerText``.  Heuristic regex patterns identify price,
    times, duration, stops, and airline.

    Args:
        raw_text: Pipe- or newline-delimited card text.

    Returns:
        Parsed :class:`FlightResult`, or ``None`` if the text does not
        look like a valid flight entry.
    """
    if not raw_text:
        return None

    text = raw_text.strip()

    # ── Price ────────────────────────────────────────────────
    price_match = re.search(r"[\$€£]\s*([\d,]+(?:\.\d{2})?)", text)
    if not price_match:
        price_match = re.search(r"([\d,]+(?:\.\d{2})?)\s*(?:USD|EUR|GBP)", text)
    if not price_match:
        return None  # no price → not a valid flight entry

    price = float(price_match.group(1).replace(",", ""))

    # ── Currency ─────────────────────────────────────────────
    currency = "USD"
    if "€" in text:
        currency = "EUR"
    elif "£" in text:
        currency = "GBP"

    # ── Times ────────────────────────────────────────────────
    time_pattern = r"(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)(?:\s*\+\d)?)"
    times = re.findall(time_pattern, text, re.IGNORECASE)
    departure_time = times[0].strip() if len(times) >= 1 else "N/A"
    arrival_time = times[1].strip() if len(times) >= 2 else "N/A"

    # ── Duration ─────────────────────────────────────────────
    duration = _extract_duration(text)

    # ── Stops ────────────────────────────────────────────────
    stops = _extract_stops(text)

    # ── Airline ──────────────────────────────────────────────
    airline = _extract_airline(text)
    if airline is None:
        return None

    try:
        return FlightResult(
            airline=airline,
            departure_time=departure_time,
            arrival_time=arrival_time,
            duration=duration,
            stops=stops,
            price=price,
            currency=currency,
            flight_url=None,
        )
    except Exception:
        return None


def try_parse_raw_text_flights(text: str) -> list[FlightResult] | None:
    """Parse a JSON array of ``{raw_text: ...}`` objects into flight results.

    Falls back to :func:`try_parse_plain_text_flights` if the input
    is not valid JSON.

    Args:
        text: Raw string that may be a JSON array or plain page text.

    Returns:
        List of parsed flights, or ``None`` if nothing was extractable.
    """
    if not text or not isinstance(text, str):
        return None

    text = text.strip()

    # Try parsing as JSON array of {raw_text: ...} objects
    data = _try_load_json_array(text)

    if not data or not isinstance(data, list):
        return try_parse_plain_text_flights(text)

    results: list[FlightResult] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        raw = item.get("raw_text", "")
        if not raw:
            continue
        flight = parse_raw_text_to_flight(raw)
        if flight:
            results.append(flight)

    return results if results else None


def try_parse_plain_text_flights(text: str) -> list[FlightResult] | None:
    """Last-resort parser: scan plain text for flight-like patterns.

    Tries two strategies:

    A) Split on double newlines and parse each chunk (Kayak-style).
    B) Scan for price markers and grab surrounding lines as context
       (Google Flights style).

    Args:
        text: Plain page text to scan.

    Returns:
        List of parsed flights, or ``None`` if nothing was extractable.
    """
    if not text or len(text) < 20:
        return None

    results: list[FlightResult] = []

    # Strategy A: double-newline separated chunks
    chunks = re.split(r"\n{2,}|\r\n{2,}", text)
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk or not re.search(r"[\$€£]\s*\d", chunk):
            continue
        flight = parse_raw_text_to_flight(chunk)
        if flight and flight.price > 0:
            results.append(flight)

    if results:
        return results

    # Strategy B: price-marker scan with surrounding context
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if re.search(r"[\$€£]\s*\d", line):
            start = max(0, i - 8)
            end = min(len(lines), i + 3)
            context_block = "\n".join(lines[start:end])
            flight = parse_raw_text_to_flight(context_block)
            if flight and flight.price > 0:
                results.append(flight)
                i = end
                continue
        i += 1

    return results if results else None


# ── Private helpers ─────────────────────────────────────────────


def _try_load_json_array(text: str) -> list | None:
    """Attempt to parse *text* as a JSON array, with fallback regex."""
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except (json.JSONDecodeError, TypeError):
        pass

    # Try extracting a JSON array from markdown code blocks or surrounding text
    for match in re.finditer(r"\[\s*\{.*?\}\s*\]", text, re.DOTALL):
        try:
            data = json.loads(match.group())
            if isinstance(data, list):
                return data
        except (json.JSONDecodeError, TypeError):
            continue

    return None


def _extract_duration(text: str) -> str:
    """Extract flight duration, skipping layover durations."""
    for dm in re.finditer(
        r"(\d+)\s*h(?:r|rs|ours?)?\s*(?:(\d+)\s*m(?:in)?)?",
        text,
        re.IGNORECASE,
    ):
        after_text = text[dm.end() : dm.end() + 30]
        if re.match(r"\s*layover", after_text, re.IGNORECASE):
            continue
        hours = dm.group(1)
        mins = dm.group(2)
        return f"{hours}h" + (f" {mins}m" if mins else "")

    # Fallback: "X hours Y minutes"
    m = re.search(
        r"(\d+)\s*hours?\s*(?:(\d+)\s*min(?:ute)?s?)?",
        text,
        re.IGNORECASE,
    )
    if m:
        hours = m.group(1)
        mins = m.group(2)
        return f"{hours}h" + (f" {mins}m" if mins else "")

    return "N/A"


def _extract_stops(text: str) -> int:
    """Extract the number of stops from text."""
    stops_match = re.search(r"(\d+)\s*stop", text, re.IGNORECASE)
    if stops_match:
        return int(stops_match.group(1))
    if re.search(r"non\s*stop|direct", text, re.IGNORECASE):
        return 0
    return 0


def _extract_airline(text: str) -> str | None:
    """Identify the airline name from pipe- or newline-delimited text.

    Walks through segments and skips anything that matches known
    non-airline patterns (times, prices, airport codes, UI labels, etc.).

    Returns:
        Airline name string, or ``None`` if no plausible name is found.
    """
    parts = (
        [p.strip() for p in text.split("|")]
        if "|" in text
        else [p.strip() for p in text.split("\n")]
    )

    for part in parts:
        part_clean = part.strip()
        if not part_clean or len(part_clean) < 3:
            continue
        if len(part_clean) > 50:
            continue

        # Skip known non-airline patterns
        if re.match(r"^\d{1,2}:\d{2}", part_clean):
            continue
        if re.match(r"^[\$€£]", part_clean):
            continue
        if re.match(r"^\d+\s*h", part_clean, re.IGNORECASE):
            continue
        if re.match(r"^\d+\s*stop", part_clean, re.IGNORECASE):
            continue
        if re.match(r"^(nonstop|non-stop|direct)\b", part_clean, re.IGNORECASE):
            continue
        if re.match(r"^[A-Z]{3}$", part_clean):
            continue
        if re.match(r"^[A-Z]{3}\s*[\u2013\u2014\u2013-]\s*[A-Z]{3}$", part_clean):
            continue
        if re.match(r"^\d+$", part_clean):
            continue
        if part_clean == "-":
            continue
        if re.search(r"layover", part_clean, re.IGNORECASE):
            continue
        if re.search(r"\d+:\d+.*[\u2013-]\s*\d+:\d+", part_clean):
            continue
        if _SKIP_PREFIXES.match(part_clean):
            continue
        if _MARKETING_WORDS.search(part_clean):
            continue

        # Passed all filters — likely an airline name
        return part_clean

    # No plausible airline found; reject
    return None
