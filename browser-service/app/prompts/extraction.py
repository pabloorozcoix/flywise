"""Extraction-specific prompt for structured flight data output."""


def build_extraction_prompt() -> str:
    """Build the extraction prompt for structured data from Kayak results.

    This prompt is used when the agent needs to return data in a specific
    JSON schema (e.g., via ``output_model_schema``).

    Returns:
        Prompt string describing the expected output format.
    """
    return """Extract all flight results visible on this Kayak results page.

For each flight option, extract:
{
  "airline": "airline name",
  "departure_time": "departure time as shown",
  "arrival_time": "arrival time as shown",
  "duration": "flight duration (e.g., 9h 40m)",
  "stops": 0,
  "price": 522.00,
  "currency": "USD",
  "flight_url": null
}

Return a JSON array of all flights. If no flights are visible, return [].
"""
