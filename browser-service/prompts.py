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

    prompt = f"""You are a flight search assistant. Your task is to search Kayak for flights and extract the results.

## Step 1: Navigate to Kayak
Go to this URL:
{url}

## Step 2: Detect and Dismiss Blocking Dialogs / Modals (CRITICAL)
Kayak frequently shows blocking popups that must be closed before results are visible.

While ANY modal, dialog, overlay, or banner is visible:
- Look for a close button (❌, "X") and click it.
- If a dialog offers options like:
  - "No thanks"
  - "Skip"
  - "Continue without signing in"
  - "Compare later"
  - "Maybe later"
  → click the option that dismisses the dialog.
- If a sign-in or "Nice seeing you again" modal appears:
  - DO NOT sign in.
  - Close it using ❌ or a dismiss option.
- If a price comparison popup appears:
  - Close it using ❌ or "Compare all" → then immediately close the next dialog.
- If a cookie or privacy banner appears:
  - Click "Accept", "Accept all", or the minimal option that removes the banner.
- If no clickable dismiss option is visible:
  - Press the ESC key once and re-check.
- If a CAPTCHA appears, wait a few seconds and try again.

## Step 3: Wait for Results to Load
- Wait for the flight results to fully load on the page.
- You will see flight cards with airline names, times, duration, stops, and prices.
- If there is a "Show more results" button, click it to load additional flights.

## Step 4: Extract Results
Use the extract_content action to extract ALL visible flight results from the page.

For each flight, extract:
- **airline**: The airline name (e.g., "British Airways", "Delta", "United")
- **departure_time**: Departure time as shown (e.g., "10:30 AM" or "10:30")
- **arrival_time**: Arrival time as shown (e.g., "6:00 PM" or "18:00")
- **duration**: Total flight duration (e.g., "7h 30m")
- **stops**: Number of stops (0 for nonstop, 1, 2, etc.)
- **price**: The price as a number without currency symbol (e.g., 450)
- **currency**: The currency code (usually "USD")
- **flight_url**: If available, the booking link URL

Return the results as a JSON array of objects with the fields above.

Route: {origin_upper} → {destination_upper}
Departure: {departure_str}"""

    if return_str:
        prompt += f"\nReturn: {return_str}"

    prompt += f"""\nCabin: {cabin_display}
{"Nonstop only" if direct_only else "Any number of stops"}

IMPORTANT:
- Extract ALL visible flights, not just the first few.
- If prices show a range, use the lowest price.
- If a flight shows "+1" next to the arrival time, it arrives the next day — still record it.
- Ignore sponsored or ad results if any.
- If no results are found, return an empty array [].
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
