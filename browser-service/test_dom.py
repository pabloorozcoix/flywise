"""Test Kayak & Google Flights with stealth settings."""
import asyncio
import json
import traceback
from browser_use import Browser


STEALTH_JS = """
// Override navigator.webdriver
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});

// Add Chrome runtime
window.chrome = {runtime: {}, loadTimes: function(){}, csi: function(){}, app: {}};

// Override permissions
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
    parameters.name === 'notifications' ?
        Promise.resolve({state: Notification.permission}) :
        originalQuery(parameters);

// Override plugins
Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
});

// Override languages
Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
});
"""


async def test():
    session = None
    try:
        session = Browser(
            headless=True,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-infobars",
                "--disable-dev-shm-usage",
                "--disable-features=IsolateOrigins,site-per-process",
            ],
            window_size={"width": 1920, "height": 1080},
            disable_security=True,
        )

        await session.start()
        page = await session.get_current_page()

        # Inject stealth JS before navigation
        cdp = await session.get_or_create_cdp_session()

        await cdp.cdp_client.send.Page.enable(session_id=cdp.session_id)
        await cdp.cdp_client.send.Page.addScriptToEvaluateOnNewDocument(
            params={"source": STEALTH_JS},
            session_id=cdp.session_id,
        )
        print("Stealth JS injected", flush=True)

        # Test 1: Kayak
        kayak_url = "https://www.kayak.com/flights/JFK-LHR/2026-04-01/2026-07-31?sort=price_a&fs=cabin=e"
        print(f"\n=== TEST KAYAK ===", flush=True)
        print(f"Navigating to: {kayak_url}", flush=True)
        await page.goto(kayak_url)
        await asyncio.sleep(15)

        kayak_url_result = await cdp.cdp_client.send.Runtime.evaluate(
            params={"expression": "window.location.href", "returnByValue": True},
            session_id=cdp.session_id,
        )
        kayak_actual_url = kayak_url_result.get("result", {}).get("value", "")
        print(f"Actual URL: {kayak_actual_url}", flush=True)
        bot_blocked = "bot" in kayak_actual_url.lower() or "help" in kayak_actual_url.lower()
        print(f"Bot blocked: {bot_blocked}", flush=True)

        if not bot_blocked:
            text_result = await cdp.cdp_client.send.Runtime.evaluate(
                params={"expression": "document.body.innerText.substring(0, 2000)", "returnByValue": True},
                session_id=cdp.session_id,
            )
            print(f"Body text: {text_result.get('result', {}).get('value', '')[:500]}", flush=True)

        # Test 2: Google Flights
        google_url = "https://www.google.com/travel/flights?q=flights+from+JFK+to+LHR+on+2026-04-01+returning+2026-07-31&curr=USD&hl=en"
        print(f"\n=== TEST GOOGLE FLIGHTS ===", flush=True)
        print(f"Navigating to: {google_url}", flush=True)
        await page.goto(google_url)
        await asyncio.sleep(15)

        google_url_result = await cdp.cdp_client.send.Runtime.evaluate(
            params={"expression": "window.location.href", "returnByValue": True},
            session_id=cdp.session_id,
        )
        google_actual_url = google_url_result.get("result", {}).get("value", "")
        print(f"Actual URL: {google_actual_url}", flush=True)

        # Check selectors on Google Flights
        google_selectors = """
        (function() {
            var sels = ['[data-resultid]', '[role="listitem"]', 'li[class]',
                        '[class*="result"]', '[class*="pIav"]', '[class*="flight"]',
                        '[jsname]', '[data-ved]'];
            var results = {};
            for (var i = 0; i < sels.length; i++) {
                results[sels[i]] = document.querySelectorAll(sels[i]).length;
            }
            return JSON.stringify(results);
        })()
        """
        sel_result = await cdp.cdp_client.send.Runtime.evaluate(
            params={"expression": google_selectors, "returnByValue": True},
            session_id=cdp.session_id,
        )
        print(f"Selector counts: {sel_result.get('result', {}).get('value', 'N/A')}", flush=True)

        # Get body text
        text_result2 = await cdp.cdp_client.send.Runtime.evaluate(
            params={"expression": "document.body.innerText.substring(0, 3000)", "returnByValue": True},
            session_id=cdp.session_id,
        )
        body = text_result2.get("result", {}).get("value", "")
        print(f"\nBody text ({len(body)} chars):", flush=True)
        print(body[:2000], flush=True)

    except Exception as e:
        print(f"FATAL ERROR: {e}", flush=True)
        traceback.print_exc()
    finally:
        if session:
            try:
                await session.stop()
            except Exception:
                pass
        print("\nDone.", flush=True)


if __name__ == "__main__":
    asyncio.run(test())



