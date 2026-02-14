"""Quick diagnostic: does Kayak redirect our clean URL?"""
import asyncio
from browser_use import BrowserSession

STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){} };
const origQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
  parameters.name === 'notifications'
    ? Promise.resolve({ state: Notification.permission })
    : origQuery(parameters);
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
"""

URL = "https://www.kayak.com/flights/JFK-LHR/2025-09-10/2025-09-20?sort=price_a&fs=cabin=e"

async def main():
    browser = BrowserSession(headless=True, disable_security=True)
    await browser.start()

    # Inject stealth
    cdp = await browser.get_or_create_cdp_session()
    await cdp.cdp_client.send.Page.enable(session_id=cdp.session_id)
    await cdp.cdp_client.send.Page.addScriptToEvaluateOnNewDocument(
        params={"source": STEALTH_JS}, session_id=cdp.session_id
    )
    print(f"Stealth injected. Navigating to: {URL}")

    page = await browser.get_current_page()
    await page.goto(URL, wait_until="domcontentloaded", timeout=30000)
    print(f"After nav, URL is: {page.url}")

    await asyncio.sleep(12)
    print(f"After 12s wait, URL is: {page.url}")

    # Check for nrc6-wrapper
    count = await page.evaluate("document.querySelectorAll('.nrc6-wrapper').length")
    print(f".nrc6-wrapper elements: {count}")

    body_text = await page.evaluate("document.body.innerText.substring(0, 500)")
    print(f"Body text (first 500 chars): {body_text[:200]}")

    # Check if we're on the form page
    has_error = await page.evaluate("document.body.innerText.includes('errorOccurred') || window.location.href.includes('errorOccurred')")
    print(f"Error occurred? {has_error}")
    has_results = await page.evaluate("document.body.innerText.includes('of') && document.body.innerText.includes('flights')")
    print(f"Has flight results text? {has_results}")

    await browser.close()
    print("Done")

asyncio.run(main())
