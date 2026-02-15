"""DOM selectors and extraction JavaScript for flight search pages.

The ``EXTRACTION_JS`` constant is evaluated directly on the Kayak results
page via Playwright's ``page.evaluate()``.  It returns *either*:

* A JSON-stringified array of ``{raw_text: "..."}`` objects (one per
  flight card), **or**
* The first 15 000 chars of the visible page text as a plain string
  (fallback when no card elements are found).
"""

# JavaScript IIFE executed via page.evaluate() to scrape flight data.
EXTRACTION_JS: str = """
() => {
    const cards = document.querySelectorAll('.nrc6-wrapper').length > 0
        ? document.querySelectorAll('.nrc6-wrapper')
        : document.querySelectorAll('.nrc6-inner').length > 0
            ? document.querySelectorAll('.nrc6-inner')
            : document.querySelectorAll('[aria-label*="Flight"]');

    if (cards.length > 0) {
        const flights = [];
        for (let i = 0; i < Math.min(cards.length, 20); i++) {
            const text = cards[i].innerText;
            if (text.match(/\\$\\d/) && text.match(/\\d+:\\d+/)) {
                const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
                flights.push({ raw_text: lines.join(' | ') });
            }
        }
        if (flights.length > 0) return JSON.stringify(flights);
    }

    const main = document.querySelector('[role="main"], main, .resultsList');
    const container = main || document.body;
    return container.innerText.substring(0, 15000);
}
"""
