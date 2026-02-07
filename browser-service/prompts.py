"""Agent task prompt templates for Google Flights search."""

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
    Google Flights and extracting structured flight results.

    The prompt guides the browser-use agent through:
    1. Navigating to Google Flights
    2. Filling in the search form
    3. Applying filters
    4. Extracting structured results
    """
    cabin_display = {
        "economy": "Economy",
        "business": "Business",
        "first": "First",
    }.get(cabin_class, "Economy")

    departure_str = departure_date.isoformat()
    return_str = return_date.isoformat() if return_date else None

    trip_type = "round trip" if return_date else "one way"

    prompt = f"""You are a flight search assistant. Your task is to search Google Flights and extract flight results.

## Step 1: Navigate to Google Flights
Go to https://www.google.com/travel/flights

## Step 2: Configure Trip Type
- Set the trip type to "{trip_type}"

## Step 3: Enter Route
- Clear any pre-filled origin airport
- Type "{origin}" in the origin/departure airport field and select the matching airport from the dropdown
- Clear any pre-filled destination airport  
- Type "{destination}" in the destination/arrival airport field and select the matching airport from the dropdown

## Step 4: Set Dates
- Click on the departure date field
- Select or type the date: {departure_str}"""

    if return_str:
        prompt += f"""
- Select or type the return date: {return_str}"""

    prompt += f"""
- Confirm the dates

## Step 5: Set Cabin Class
- If the cabin class is not already set to {cabin_display}, change it to {cabin_display}"""

    if direct_only:
        prompt += """

## Step 6: Filter Non-Stop Only
- Click on "Stops" filter
- Select "Nonstop only" or "1 stop or fewer" to filter for direct flights
- Apply the filter"""

    prompt += """

## Step 7: Wait for Results
- Wait for the flight results to fully load
- Ensure the page has finished loading all results

## Step 8: Extract Results
Use the extract_content action to extract ALL visible flight results from the page.

For each flight, extract:
- **airline**: The airline name (e.g., "British Airways", "Delta")
- **departure_time**: Departure time as shown (e.g., "10:30 AM")
- **arrival_time**: Arrival time as shown (e.g., "6:00 PM")  
- **duration**: Total flight duration (e.g., "7h 30m")
- **stops**: Number of stops (0 for non-stop, 1, 2, etc.)
- **price**: The price as a number without currency symbol (e.g., 450)
- **currency**: The currency code (usually "USD")

Return the results as a JSON array of objects with the fields above.

IMPORTANT:
- Extract ALL visible flights, not just the first few
- If prices show a range, use the lowest price
- If a flight shows "+1" next to arrival time, it arrives the next day — still record it
- Ignore sponsored/ad results if any
- If no results are found, return an empty array []
"""

    return prompt


def build_extraction_prompt() -> str:
    """
    Build the extraction-specific prompt for structured data extraction
    from the Google Flights results page.
    """
    return """Extract all flight results visible on this Google Flights results page.

For each flight option, extract:
{
  "airline": "airline name",
  "departure_time": "departure time as shown",
  "arrival_time": "arrival time as shown",
  "duration": "flight duration (e.g., 7h 30m)",
  "stops": 0,
  "price": 450.00,
  "currency": "USD"
}

Return a JSON array of all flights. If no flights are visible, return [].
"""
