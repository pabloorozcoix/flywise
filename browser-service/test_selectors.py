"""Test Kayak DOM selectors to find which ones match flight results."""
import asyncio
import json
from browser_use import Browser

STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
window.chrome = {runtime: {}, loadTimes: function(){}, csi: function(){}, app: {}};
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
    parameters.name === 'notifications' ?
        Promise.resolve({state: Notification.permission}) :
        originalQuery(parameters);
Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
"""

async def test():
    session = None
    try:
        session = Browser(
            headless=True,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            args=["--disable-blink-features=AutomationControlled", "--no-first-run", "--disable-infobars"],
            window_size={"width": 1920, "height": 1080},
            disable_security=True,
        )
        await session.start()
        page = await session.get_current_page()

        cdp = await session.get_or_create_cdp_session()
        await cdp.cdp_client.send.Page.enable(session_id=cdp.session_id)
        await cdp.cdp_client.send.Page.addScriptToEvaluateOnNewDocument(
            params={"source": STEALTH_JS}, session_id=cdp.session_id,
        )
        print("Stealth injected", flush=True)

        url = "https://www.kayak.com/flights/JFK-LHR/2026-05-01/2026-05-31?sort=price_a&fs=cabin=e"
        print(f"Navigating to: {url}", flush=True)
        await page.goto(url)
        await asyncio.sleep(15)

        # Test MANY selectors
        selector_js = """
        (function() {
            var sels = [
                '[data-resultid]',
                '[role="listitem"]',
                '[role="option"]',
                '.nrc6-inner', '.nrc6', '[class*="nrc6"]',
                '.resultWrapper', '.resultInner',
                '.Iqt3', '[class*="Iqt3"]',
                '[class*="result"]', '[class*="Result"]',
                '[class*="flight"]', '[class*="Flight"]',
                '[class*="card"]', '[class*="Card"]',
                '.c_cgF', '[class*="c_cgF"]',
                '.Fxw9', '[class*="Fxw9"]',
                '.hJSA', '[class*="hJSA"]',
                'li', 'li[class]',
                '[class*="inner"]',
                '[data-content]', '[data-resulttype]',
                'div[tabindex]',
                '[aria-label*="flight"]', '[aria-label*="Flight"]',
                '[aria-label]',
                'a[href*="/book/"]',
            ];
            var results = {};
            for (var i = 0; i < sels.length; i++) {
                try {
                    results[sels[i]] = document.querySelectorAll(sels[i]).length;
                } catch(e) {
                    results[sels[i]] = 'error: ' + e.message;
                }
            }
            return JSON.stringify(results);
        })()
        """
        sel_result = await cdp.cdp_client.send.Runtime.evaluate(
            params={"expression": selector_js, "returnByValue": True},
            session_id=cdp.session_id,
        )
        sel_data = json.loads(sel_result.get("result", {}).get("value", "{}"))
        print("\n=== SELECTOR COUNTS ===", flush=True)
        for sel, count in sorted(sel_data.items(), key=lambda x: -x[1] if isinstance(x[1], int) else 0):
            if isinstance(count, int) and count > 0:
                print(f"  {sel}: {count}", flush=True)

        # Now try to get the OUTER HTML of the first few elements that look like results
        # Try the top selectors that had non-zero counts and inspect their structure
        inspect_js = """
        (function() {
            // Strategy: find elements that contain BOTH a price ($) and a time (HH:MM)
            var all = document.querySelectorAll('div, li, section, article');
            var candidates = [];
            for (var i = 0; i < all.length; i++) {
                var el = all[i];
                var text = el.innerText || '';
                // Must have price + time + be within a reasonable size
                if (text.match(/\\$\\d/) && text.match(/\\d{1,2}:\\d{2}/) && text.length > 50 && text.length < 2000) {
                    // Check it's not a container of multiple results
                    var childMatches = 0;
                    var children = el.querySelectorAll('div, li');
                    for (var j = 0; j < children.length; j++) {
                        var ct = children[j].innerText || '';
                        if (ct.match(/\\$\\d/) && ct.match(/\\d{1,2}:\\d{2}/) && ct.length > 50 && ct.length < 2000) {
                            childMatches++;
                        }
                    }
                    // If this element has 0 child matches with the same pattern, it's likely a leaf result
                    if (childMatches <= 1) {
                        candidates.push({
                            tag: el.tagName,
                            classes: el.className.substring(0, 100),
                            dataAttrs: Array.from(el.attributes).filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value).join(', '),
                            textLen: text.length,
                            text: text.substring(0, 300)
                        });
                    }
                }
                if (candidates.length >= 5) break;
            }
            return JSON.stringify(candidates, null, 2);
        })()
        """
        inspect_result = await cdp.cdp_client.send.Runtime.evaluate(
            params={"expression": inspect_js, "returnByValue": True},
            session_id=cdp.session_id,
        )
        print("\n=== CANDIDATE FLIGHT ELEMENTS ===", flush=True)
        print(inspect_result.get("result", {}).get("value", "none"), flush=True)

        # Also get a 3000-char body text snippet for reference
        text_result = await cdp.cdp_client.send.Runtime.evaluate(
            params={"expression": "document.body.innerText.substring(0, 3000)", "returnByValue": True},
            session_id=cdp.session_id,
        )
        print("\n=== BODY TEXT (first 3000 chars) ===", flush=True)
        print(text_result.get("result", {}).get("value", ""), flush=True)

    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        if session:
            try:
                await session.stop()
            except:
                pass

asyncio.run(test())
