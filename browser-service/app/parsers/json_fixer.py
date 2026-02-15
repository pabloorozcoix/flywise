"""Utilities for repairing malformed JSON produced by LLM outputs.

LLMs frequently produce JSON with formatting errors such as:
  - Missing quotes around keys/values
  - Semicolons instead of colons inside time strings
  - Smart/typographic quotes (``\u201c``, ``\u201d``, etc.)
  - Trailing spaces in values
  - Truncated arrays with ellipsis placeholders
  - Trailing commas before ``]`` or ``}``
  - Spaces in key names (e.g., ``"arrival _time"``)

The functions in this module apply heuristic fixes so that the
resulting string is parseable by :func:`json.loads`.
"""

from __future__ import annotations

import json
import re


def fix_malformed_json(text: str) -> str:
    """Apply a series of regex-based fixes to make *text* JSON-parseable.

    This is intentionally aggressive — it targets patterns the LLM is known
    to produce rather than being a general-purpose JSON repair library.

    Args:
        text: Raw string that *should* be JSON but contains errors.

    Returns:
        Cleaned string with a higher chance of being valid JSON.
    """
    s = text

    # Replace smart/typographic quotes with standard quotes
    s = s.replace("\u201e", '"')  # „
    s = s.replace("\u201c", '"')  # "
    s = s.replace("\u201d", '"')  # "
    s = s.replace("\u2018", "'")  # '
    s = s.replace("\u2019", "'")  # '

    # Remove truncated placeholder entries like { ... (remaining ...) ... }
    s = re.sub(r"\{[^{}]*\.\.\.[^{}]*\}", "", s)

    # Remove trailing commas before ] or }
    s = re.sub(r",\s*([}\]])", r"\1", s)

    # Fix spaces in key names like "arrival _time": → "arrival_time":
    # Only target keys (followed by a colon) to avoid corrupting values
    s = re.sub(
        r'"(\w+)\s+(\w+)"\s*:',
        lambda m: f'"{m.group(1)}_{m.group(2)}":',
        s,
    )
    # Also fix unquoted keys with spaces
    s = re.sub(r"(\w+)\s+_(\w+)\s*:", r'"\1_\2":', s)
    s = re.sub(r"(\w+)_\s+(\w+)\s*:", r'"\1_\2":', s)

    # Fix missing quotes around keys: {airline: → {"airline":
    s = re.sub(r'(?<=[{,\s])(\w[\w_]*)\s*:', r'"\1":', s)

    # Fix semicolons used as colons inside quoted values: "8;25am" → "8:25am"
    def _fix_semicolons_in_values(m: re.Match[str]) -> str:
        return m.group(0).replace(";", ":")

    s = re.sub(r'"[^"]*;[^"]*"', _fix_semicolons_in_values, s)

    # Strip trailing spaces inside quoted values
    def _strip_value_spaces(m: re.Match[str]) -> str:
        return f'"{m.group(1).strip()}"'

    s = re.sub(r'"([^"]*\S)\s+"', _strip_value_spaces, s)

    # Fix unquoted string values after colon
    # Preserve null, true, false, and numbers
    s = re.sub(
        r':\s*(?!")(?!null|true|false|\d)([A-Za-z][A-Za-z0-9\s+:]*?)(?=\s*[,}\]])',
        lambda m: f': "{m.group(1).strip()}"',
        s,
    )

    return s


def extract_individual_objects(text: str) -> list[dict] | None:
    """Extract individual JSON objects from *text* even if the array is invalid.

    Walks through the string tracking brace depth and attempts to parse
    each ``{…}`` block independently, falling back to
    :func:`fix_malformed_json` on individual blocks if needed.

    Args:
        text: String potentially containing multiple JSON objects.

    Returns:
        List of parsed dicts, or ``None`` if nothing was extractable.
    """
    objects: list[dict] = []
    depth = 0
    start = -1

    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                block = text[start : i + 1]
                obj = _try_parse_block(block)
                if obj is not None:
                    objects.append(obj)
                start = -1

    return objects if objects else None


def _try_parse_block(block: str) -> dict | None:
    """Attempt to parse a single ``{…}`` JSON block.

    Tries raw parsing first, then applies :func:`fix_malformed_json`.
    Only returns flight-relevant objects (those containing airline/price/time fields).
    """
    _flight_keys = {"airline", "airline_name", "departure_time", "price"}

    for candidate in (block, fix_malformed_json(block)):
        try:
            obj = json.loads(candidate)
            if isinstance(obj, dict) and _flight_keys & obj.keys():
                return obj
        except (json.JSONDecodeError, TypeError):
            continue

    return None
