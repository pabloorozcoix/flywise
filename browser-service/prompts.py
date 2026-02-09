"""Agent task prompt templates for Kayak flight search."""

from datetime import date
from typing import Optional


def build_flight_search_prompt(
    origin: str,
    destination: str,
    departure_date: date,
    return_date: Optional[date] = None,
    cabin_class: str = "economy",
    direct_only: bool = False,
) -> str:
    """
    Build a detailed, step-by-step agent task prompt for searching
    Kayak and extracting structured flight results.

    The prompt guides the browser-use agent through:
    1. Navigating to Kayak via a direct URL
    2. Waiting for results to load
    3. Applying filters (stops, cabin class)
    4. Extracting structured results
    """
    cabin_map = {
        "economy": "e",
        "premium_economy": "p",
        "business": "b",
        "first": "f",
    }
    cabin_code = cabin_map.get(cabin_class, "e")
    cabin_display = {
        "economy": "Economy",
        "premium_economy": "Premium Economy",
        "business": "Business",
        "first": "First",
    }.get(cabin_class, "Economy")

    departure_str = departure_date.isoformat()  # YYYY-MM-DD
    return_str = return_date.isoformat() if return_date else None

    # Build the Kayak direct-search URL
    origin_upper = origin.upper()
    destination_upper = destination.upper()

    if return_str:
        # Round-trip URL: /flights/JFK-LHR/2026-03-15/2026-03-22
        url = (
            f"https://www.kayak.com/flights"
            f"/{origin_upper}-{destination_upper}"
            f"/{departure_str}/{return_str}"
            f"?sort=price_a&fs=cabin={cabin_code}"
        )
    else:
        # One-way URL: /flights/JFK-LHR/2026-03-15
        url = (
            f"https://www.kayak.com/flights"
            f"/{origin_upper}-{destination_upper}"
            f"/{departure_str}"
            f"?sort=price_a&fs=cabin={cabin_code}"
        )

    if direct_only:
        url += ";stops=0"

    prompt = f"""You are a flight search assistant. Search Kayak for flights and extract results.

## Step 1: Navigate to Kayak
Go to this URL:
{url}

## Step 2: Dismiss Any Dialogs
If any popup, modal, or banner appears, dismiss it:
- Click close (❌ / "X"), "No thanks", "Skip", "Maybe later", or "Accept".
- For sign-in modals: close without signing in.
- Press ESC if no close button is visible.
- Do NOT spend more than 2 steps on dialogs.

## Step 3: Wait for Results
- Wait for flight cards to appear (airline names, times, prices).
- If a "Show more results" button is visible, click it ONCE.

## Step 4: Extract Results (DO THIS ONCE)
Use extract_content to extract ALL visible flight results.

For each flight extract these fields:
- airline (string)
- departure_time (string, as shown)
- arrival_time (string, as shown, include +1 if next day)
- duration (string, e.g. "7h 30m")
- stops (number: 0, 1, 2...)
- price (number, without $ sign)
- currency (string, usually "USD")
- flight_url (string or null — it is OK if this is null)

## Step 5: Call done IMMEDIATELY
After extracting, call the `done` action with the results as a JSON array.
Do NOT try to re-extract, refine, or find booking URLs.
Do NOT repeat extraction — one attempt is sufficient.
If extraction returned data, use it as-is and call done.

Route: {origin_upper} → {destination_upper}
Departure: {departure_str}"""

    if return_str:
        prompt += f"\nReturn: {return_str}"

    prompt += f"""\nCabin: {cabin_display}
{"Nonstop only" if direct_only else "Any number of stops"}

CRITICAL RULES:
- Extract ALL visible flights, not just the first few.
- If prices show a range, use the lowest price.
- Ignore sponsored or ad results.
- flight_url can be null — do NOT loop trying to find booking URLs.
- After ONE extraction attempt, call done with whatever results you have.
- NEVER repeat the extraction step. One extract_content call is enough.
- If no results are found, call done with an empty array [].
"""

    return prompt


def build_extraction_prompt() -> str:
    """
    Build the extraction-specific prompt for structured data extraction
    from the Kayak results page.
    """
    return """Extract all flight results visible on this Kayak results page.

For each flight option, extract:
{
  "airline": "airline name",
  "departure_time": "departure time as shown",
  "arrival_time": "arrival time as shown",
  "duration": "flight duration (e.g., 7h 30m)",
  "stops": 0,
  "price": 450.00,
  "currency": "USD",
  "flight_url": "booking link if available"
}

Return a JSON array of all flights. If no flights are visible, return [].
"""
