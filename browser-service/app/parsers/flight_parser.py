"""Multi-strategy parser for extracting flight results from agent history.

The :func:`parse_flight_results` function applies seven strategies
(numbered 0–6) in priority order to extract :class:`FlightResult`
objects from a browser-use agent's history object.  Each strategy
targets a different location where the agent may have placed the
extracted data.
"""

from __future__ import annotations

import json
import re
from typing import Any

from app.logger import get_logger
from app.models.domain import FlightResult
from app.parsers.json_fixer import extract_individual_objects, fix_malformed_json
from app.parsers.text_parser import try_parse_raw_text_flights

logger = get_logger("parsers.flight")

# ── Key normalisation mapping ───────────────────────────────────

_KEY_MAP: dict[str, str | None] = {
    # camelCase variants
    "departureTime": "departure_time",
    "arrivalTime": "arrival_time",
    "flightUrl": "flight_url",
    # Abbreviated
    "departure": "departure_time",
    "arrival": "arrival_time",
    "url": "flight_url",
    "bookingUrl": "flight_url",
    # Descriptive (GPT-style)
    "airline_name": "airline",
    "airlineName": "airline",
    "total_duration": "duration",
    "totalDuration": "duration",
    "flight_duration": "duration",
    "flightDuration": "duration",
    "number_of_stops": "stops",
    "numberOfStops": "stops",
    "numStops": "stops",
    "num_stops": "stops",
    "stop_count": "stops",
    "currency_code": "currency",
    "currencyCode": "currency",
    "booking_link_url": "flight_url",
    "bookingLinkUrl": "flight_url",
    "booking_url": "flight_url",
    "booking_link": "flight_url",
    # Sentinel — handled separately
    "nonstop": None,
}


# ── Public API ──────────────────────────────────────────────────


def parse_flight_results(history: Any) -> list[FlightResult]:
    """Extract flight results from a browser-use agent history.

    Attempts the following strategies in order, returning as soon as
    one succeeds:

    0. Structured output (``output_model_schema`` → ``FlightResultsOutput``)
    1. ``final_result()`` string → JSON
    2. All ``extracted_content`` from every history step
    3. ``action_results()`` method
    4. ``model_actions`` evaluate results
    5. ``done`` action text
    6. ``raw_text`` objects from JavaScript evaluate output

    Args:
        history: Agent history object (e.g., ``AgentHistoryList``).

    Returns:
        List of :class:`FlightResult` (possibly empty).
    """
    for strategy_fn in (
        _strategy_0_structured_output,
        _strategy_1_final_result,
        _strategy_2_extracted_content,
        _strategy_3_action_results,
        _strategy_4_model_actions,
        _strategy_5_done_action,
        _strategy_6_raw_text,
    ):
        results = strategy_fn(history)
        if results:
            return results

    logger.warning("No results could be parsed from agent history")
    return []


def try_parse_flight_json(text: str) -> list[FlightResult] | None:
    """Try to parse flight results from a string that may contain JSON.

    Handles malformed JSON typical of LLM outputs by applying
    :func:`~app.parsers.json_fixer.fix_malformed_json` before parsing.

    Args:
        text: Raw string potentially containing flight JSON.

    Returns:
        List of :class:`FlightResult` if successful, ``None`` otherwise.
    """
    if not text or not isinstance(text, str):
        return None

    text = text.strip()
    cleaned = fix_malformed_json(text)

    # Try direct parse on cleaned text
    data = _safe_json_loads(cleaned)

    # Try finding JSON array in text (e.g., wrapped in markdown code blocks)
    if data is None:
        for match in re.findall(r"\[\s*\{.*?\}\s*\]", cleaned, re.DOTALL):
            data = _safe_json_loads(match)
            if data is not None:
                break

    # Fallback: extract individual JSON objects
    if data is None:
        data = extract_individual_objects(cleaned)

    # Last resort: try the original text
    if data is None:
        data = _safe_json_loads(text)

    if data is None:
        return None

    return _data_to_flights(data)


def normalize_result_keys(data: dict) -> dict:
    """Normalise key names and value types to match :class:`FlightResult`.

    Handles camelCase, descriptive names, boolean ``nonstop``, string
    stops/price, and missing defaults.

    Args:
        data: Raw dict with potentially non-standard keys.

    Returns:
        Dict with keys matching :class:`FlightResult` field names.
    """
    normalized: dict[str, Any] = {}

    for key, value in data.items():
        mapped_key = _KEY_MAP.get(key, key)
        if mapped_key is not None:
            if isinstance(value, str):
                value = value.strip()
            normalized[mapped_key] = value

    # Handle "nonstop" boolean → stops=0
    if data.get("nonstop") and "stops" not in normalized:
        normalized["stops"] = 0

    # Default stops to 0
    if "stops" not in normalized:
        normalized["stops"] = 0

    # Normalise stops from string
    if isinstance(normalized.get("stops"), str):
        stops_str = normalized["stops"].lower().strip()
        if any(kw in stops_str for kw in ("nonstop", "non-stop", "direct")):
            normalized["stops"] = 0
        else:
            m = re.search(r"(\d+)", stops_str)
            normalized["stops"] = int(m.group(1)) if m else 0

    # Default currency
    if "currency" not in normalized:
        normalized["currency"] = "USD"

    # Normalise price from string (e.g., "$522", "522 USD")
    if isinstance(normalized.get("price"), str):
        price_str = normalized["price"].replace(",", "")
        m = re.search(r"[\d]+\.?\d*", price_str)
        normalized["price"] = float(m.group(0)) if m else 0.0

    return normalized


# ── Strategy implementations ───────────────────────────────────


def _strategy_0_structured_output(history: Any) -> list[FlightResult] | None:
    """Strategy 0: structured output from output_model_schema."""
    try:
        final = _get_final_result(history)
        if not final:
            return None
        data = json.loads(final)
        if isinstance(data, dict) and "flights" in data:
            return _items_to_flights(data["flights"])
    except (json.JSONDecodeError, TypeError, Exception) as e:
        logger.debug(f"Strategy 0 failed: {e}")
    return None


def _strategy_1_final_result(history: Any) -> list[FlightResult] | None:
    """Strategy 1: parse final_result() string."""
    try:
        final = _get_final_result(history)
        if final:
            parsed = try_parse_flight_json(final)
            if parsed:
                logger.info(f"Parsed {len(parsed)} results from final_result()")
                return parsed
    except Exception as e:
        logger.debug(f"Strategy 1 failed: {e}")
    return None


def _strategy_2_extracted_content(history: Any) -> list[FlightResult] | None:
    """Strategy 2: scan all extracted_content from history steps."""
    if not hasattr(history, "history"):
        return None
    try:
        for entry in reversed(history.history):
            if not hasattr(entry, "result") or not entry.result:
                continue
            for action_result in reversed(entry.result):
                content = getattr(action_result, "extracted_content", None)
                if content:
                    parsed = try_parse_flight_json(content)
                    if parsed:
                        logger.info(f"Parsed {len(parsed)} results from extracted_content")
                        return parsed
    except Exception as e:
        logger.debug(f"Strategy 2 failed: {e}")
    return None


def _strategy_3_action_results(history: Any) -> list[FlightResult] | None:
    """Strategy 3: try action_results() method."""
    try:
        if not (hasattr(history, "action_results") and callable(history.action_results)):
            return None
        for ar in reversed(history.action_results()):
            content = getattr(ar, "extracted_content", None)
            if content:
                parsed = try_parse_flight_json(content)
                if parsed:
                    logger.info(f"Parsed {len(parsed)} results from action_results()")
                    return parsed
    except Exception as e:
        logger.debug(f"Strategy 3 failed: {e}")
    return None


def _strategy_4_model_actions(history: Any) -> list[FlightResult] | None:
    """Strategy 4: scan model_actions for evaluate results."""
    if not hasattr(history, "history"):
        return None
    try:
        for entry in reversed(history.history):
            mo = getattr(entry, "model_output", None)
            if not mo or not hasattr(mo, "action"):
                continue
            for act in reversed(mo.action):
                act_dict = act.model_dump(exclude_none=True) if hasattr(act, "model_dump") else {}
                for key in ("evaluate", "extract_content", "extract"):
                    if key not in act_dict:
                        continue
                    val = act_dict[key]
                    if isinstance(val, dict):
                        val = val.get("code", val.get("value", val.get("script", "")))
                    if isinstance(val, str):
                        parsed = try_parse_flight_json(val)
                        if parsed:
                            logger.info(f"Parsed {len(parsed)} results from {key} action")
                            return parsed
    except Exception as e:
        logger.debug(f"Strategy 4 failed: {e}")
    return None


def _strategy_5_done_action(history: Any) -> list[FlightResult] | None:
    """Strategy 5: scan 'done' action text for JSON."""
    if not hasattr(history, "history"):
        return None
    try:
        for entry in reversed(history.history):
            mo = getattr(entry, "model_output", None)
            if not mo or not hasattr(mo, "action"):
                continue
            for act in mo.action:
                act_dict = act.model_dump(exclude_none=True) if hasattr(act, "model_dump") else {}
                if "done" not in act_dict:
                    continue
                done_val = act_dict["done"]
                done_text = done_val.get("text", "") if isinstance(done_val, dict) else str(done_val)
                if done_text:
                    parsed = try_parse_flight_json(done_text)
                    if parsed:
                        logger.info(f"Parsed {len(parsed)} results from done action text")
                        return parsed
    except Exception as e:
        logger.debug(f"Strategy 5 failed: {e}")
    return None


def _strategy_6_raw_text(history: Any) -> list[FlightResult] | None:
    """Strategy 6: parse raw_text objects from JavaScript evaluate output."""
    if not hasattr(history, "history"):
        return None
    try:
        for entry in reversed(history.history):
            if not hasattr(entry, "result") or not entry.result:
                continue
            for action_result in reversed(entry.result):
                content = getattr(action_result, "extracted_content", None)
                if not content or not isinstance(content, str):
                    continue
                parsed = try_parse_raw_text_flights(content)
                if parsed:
                    logger.info(f"Parsed {len(parsed)} results from raw_text JS output (Strategy 6)")
                    return parsed
    except Exception as e:
        logger.debug(f"Strategy 6 failed: {e}")
    return None


# ── Shared helpers ──────────────────────────────────────────────


def _get_final_result(history: Any) -> str | None:
    """Safely extract the final_result() string from agent history."""
    if hasattr(history, "final_result") and callable(history.final_result):
        result = history.final_result()
        if result and isinstance(result, str):
            return result
    return None


def _safe_json_loads(text: str) -> Any:
    """Return parsed JSON or ``None`` on failure."""
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None


def _data_to_flights(data: Any) -> list[FlightResult] | None:
    """Convert parsed JSON data into a list of :class:`FlightResult`."""
    items: list[dict] = []

    if isinstance(data, list):
        items = [item for item in data if isinstance(item, dict)]
    elif isinstance(data, dict):
        for key in ("flights", "results", "data"):
            if key in data and isinstance(data[key], list):
                items = [item for item in data[key] if isinstance(item, dict)]
                break
        if not items and ("airline" in data or "airline_name" in data):
            items = [data]

    return _items_to_flights(items) if items else None


def _items_to_flights(items: list) -> list[FlightResult] | None:
    """Convert a list of raw dicts into :class:`FlightResult` objects."""
    results: list[FlightResult] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            normalized = normalize_result_keys(item)
            if not normalized.get("airline") or str(normalized["airline"]).startswith("..."):
                continue
            results.append(FlightResult(**normalized))
        except Exception as e:
            logger.debug(f"Could not parse flight item: {e}")
    return results if results else None
