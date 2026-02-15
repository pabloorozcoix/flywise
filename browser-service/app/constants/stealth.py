"""Anti-detection constants for headless browser operation.

Contains user-agent strings and stealth JavaScript that must be injected
via CDP *before* any navigation to bypass common bot-detection signals.
"""

# Stealth user agents for rotation — a mix of real browser UAs on major OSes.
USER_AGENTS: list[str] = [
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) "
        "Gecko/20100101 Firefox/133.0"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/17.2 Safari/605.1.15"
    ),
    (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
]

# Stealth JavaScript injected via CDP before any navigation.
# Overrides the most common headless-browser fingerprints that trigger
# bot detection on sites like Kayak, Google Flights, etc.
STEALTH_JS: str = """
// Override navigator.webdriver — the #1 headless detection signal
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});

// Add Chrome runtime object (present in real Chrome, missing in headless)
window.chrome = {runtime: {}, loadTimes: function(){}, csi: function(){}, app: {}};

// Override permissions API to return real-looking results
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
    parameters.name === 'notifications' ?
        Promise.resolve({state: Notification.permission}) :
        originalQuery(parameters);

// Override plugins (headless returns empty array)
Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
});

// Override languages (ensure realistic values)
Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
});
"""
