"""Kayak URL builder and agent prompt templates."""

from __future__ import annotations

from datetime import date

from app.models.enums import CabinClass

# Kayak cabin code mapping (enum value -> URL parameter)
_CABIN_CODES: dict[str, str] = {
    CabinClass.ECONOMY: "e",
    CabinClass.PREMIUM_ECONOMY: "p",
    CabinClass.BUSINESS: "b",
    CabinClass.FIRST: "f",
}

# Human-readable cabin display names
_CABIN_DISPLAY: dict[str, str] = {
    CabinClass.ECONOMY: "Economy",
    CabinClass.PREMIUM_ECONOMY: "Premium Economy",
    CabinClass.BUSINESS: "Business",
    CabinClass.FIRST: "First",
}


def build_kayak_url(
    origin: str,
    destination: str,
    departure_date: date,
    return_date: date | None = None,
    cabin_class: str = CabinClass.ECONOMY,
    direct_only: bool = False,
) -> str:
    """Build a Kayak search URL for the given flight parameters.

    Args:
        origin: Origin airport IATA code (e.g., ``"JFK"``).
        destination: Destination airport IATA code (e.g., ``"LHR"``).
        departure_date: Departure date.
        return_date: Return date (``None`` for one-way).
        cabin_class: Cabin class string or :class:`CabinClass` enum value.
        direct_only: If ``True``, filter to non-stop flights only.

    Returns:
        Fully-qualified Kayak search URL sorted by price ascending.
    """
    cabin_code = _CABIN_CODES.get(cabin_class, "e")
    departure_str = departure_date.isoformat()
    origin_upper = origin.upper()
    destination_upper = destination.upper()

    base = f"https://www.kayak.com/flights/{origin_upper}-{destination_upper}/{departure_str}"

    if return_date:
        base += f"/{return_date.isoformat()}"

    url = f"{base}?sort=price_a&fs=cabin={cabin_code}"

    if direct_only:
        url += "&fs=stops=0"

    return url


def build_flight_search_prompt(
    origin: str,
    destination: str,
    departure_date: date,
    return_date: date | None = None,
    cabin_class: str = CabinClass.ECONOMY,
    direct_only: bool = False,
) -> str:
    """Build a step-by-step agent task prompt for data extraction.

    The prompt assumes the browser has *already* been navigated to the
    Kayak results page.  The agent only needs to dismiss dialogs,
    evaluate JavaScript, parse, and return structured output.

    Args:
        origin: Origin airport IATA code.
        destination: Destination airport IATA code.
        departure_date: Departure date.
        return_date: Return date (``None`` for one-way).
        cabin_class: Cabin class string or :class:`CabinClass` enum value.
        direct_only: Non-stop flights only.

    Returns:
        Multi-section prompt string ready for the browser-use agent.
    """
    cabin_display = _CABIN_DISPLAY.get(cabin_class, "Economy")
    departure_str = departure_date.isoformat()
    return_str = return_date.isoformat() if return_date else None
    origin_upper = origin.upper()
    destination_upper = destination.upper()

    url = build_kayak_url(
        origin=origin,
        destination=destination,
        departure_date=departure_date,
        return_date=return_date,
        cabin_class=cabin_class,
        direct_only=direct_only,
    )

    prompt = f"""You are a flight search assistant. Extract flight results from the Kayak results page.

## IMPORTANT: The browser has already navigated to the Kayak results page
The page at {url} has been loaded for you and results have had time to render.
You do NOT need to navigate anywhere — the flight results should already be visible.

## Step 1: Dismiss Any Dialogs
If any popup, cookie consent, or sign-in dialog appears, dismiss it by clicking
"No thanks", "Close", the X button, or pressing ESC. Do NOT spend more than 1 step on dialogs.
If there is no dialog, skip to Step 2 immediately.

## Step 2: Extract Flight Data via JavaScript
Use the `evaluate` action to run this JavaScript EXACTLY ONCE to extract flight data
directly from the rendered page:

```javascript
() => {{
  // Kayak 2025: flight result cards use the .nrc6-wrapper class
  const cards = document.querySelectorAll('.nrc6-wrapper').length > 0
    ? document.querySelectorAll('.nrc6-wrapper')
    : document.querySelectorAll('.nrc6-inner').length > 0
      ? document.querySelectorAll('.nrc6-inner')
      : document.querySelectorAll('[aria-label*="Flight"]');

  if (cards.length > 0) {{
    const flights = [];
    for (let i = 0; i < Math.min(cards.length, 20); i++) {{
      const text = cards[i].innerText;
      // Only include cards that look like flight results (contain price + time)
      if (text.match(/\\$\\d/) && text.match(/\\d+:\\d+/)) {{
        const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
        flights.push({{ raw_text: lines.join(' | ') }});
      }}
    }}
    if (flights.length > 0) {{
      return JSON.stringify(flights);
    }}
  }}

  // Strategy B: Extract from the visible body text (captures all rendered text)
  const main = document.querySelector('[role="main"], main, .resultsList');
  const container = main || document.body;
  return container.innerText.substring(0, 15000);
}}
```

## Step 3: Parse the Extracted Data
After `evaluate` returns data, IMMEDIATELY parse it — do NOT re-run the JavaScript.

The JavaScript will return EITHER:
A) A JSON array of `{{"raw_text": "..."}}` objects — each is a flight card with pipe-separated fields
B) Plain text from the page body — scan it for flight patterns

Each Kayak flight card's raw_text looks like this (pipe-separated):
`Save | Share | 6:25 pm – 9:05 am+1 | Aer Lingus | 1 stop | SNN | 1h 30m layover, Shannon | 9h 40m | JFK | - | LHR | $530 | Saver | Select`

From each card, extract:
- **airline** name (e.g. "American", "British Airways", "Delta", "Aer Lingus")
- **departure_time** and **arrival_time** (e.g. "6:25 pm", "9:05 am+1" — the +1 means next day)
- **duration** (e.g. "9h 40m", "7h 30m")
- **stops** (0 for nonstop, 1, 2, etc. — look for "nonstop" or "N stop")
- **price** (numeric USD amount, e.g. 530 from "$530")
- **currency**: "USD"

## Step 4: Return Results
Call `done` with the extracted flight data IMMEDIATELY after parsing.
- Set `success` to true if you found any flights.
- If you found NO flights, set `success` to true and return an empty flights list.
- Do NOT retry extraction — one attempt is sufficient.
- Do NOT re-run the JavaScript — parse whatever was returned on the first call.

Route: {origin_upper} → {destination_upper}
Departure: {departure_str}"""

    if return_str:
        prompt += f"\nReturn: {return_str}"

    prompt += f"""\nCabin: {cabin_display}
{"Nonstop only" if direct_only else "Any number of stops"}

CRITICAL RULES:
- The page has ALREADY been navigated to and loaded — do NOT navigate anywhere else.
- Do NOT use navigate — the browser is already on the correct page.
- Do NOT use find_elements or CSS selectors to extract data — they will fail.
- Use the `evaluate` action with JavaScript to read the DOM directly.
- If the JavaScript returns raw text, parse it yourself to identify flights.
- Extract ALL visible flights (up to 20 max).
- Kayak shows round-trip prices by default — report prices as shown.
- Ignore "Sponsored" results, ads, or "Track prices" sections.
- flight_url can be null — do NOT loop trying to find URLs.
- ⚠️ ABSOLUTELY NEVER re-run the JavaScript extraction. Run it ONCE, then parse the result.
- ⚠️ After the evaluate call, your ONLY next action must be `done` with parsed flight data.
- ⚠️ If no flight data was found, call `done` with an empty flights array immediately.
- ⚠️ Do NOT type into form fields, click search buttons, or interact with Kayak's form.
- The evaluate call WILL return data — Kayak uses .nrc6-wrapper for flight cards.
- Do NOT scroll, click, or interact with the page after extraction — just call done.
"""

    return prompt
