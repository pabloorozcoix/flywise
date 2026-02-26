"""Browser lifecycle management and stealth configuration.

Handles headless browser creation with anti-bot-detection measures,
CDP-level stealth JavaScript injection, screenshot capture, and
safe browser teardown.

Provides two browser factories:
- ``create_stealth_browser()`` — direct automation (``page.goto`` + ``page.evaluate``).
- ``create_agent_browser()`` — for browser-use Agent (relies on library stealth).
"""

from __future__ import annotations

import base64
import random

from app.constants.stealth import STEALTH_JS, USER_AGENTS
from app.logger import get_logger

logger = get_logger("services.browser")


def get_stealth_browser_config() -> dict:
    """Build browser kwargs with randomised anti-detection settings.

    Returns:
        Dict suitable for unpacking into ``Browser(**config)``.
    """
    return {
        "headless": True,
        "user_agent": random.choice(USER_AGENTS),
        "args": [
            "--disable-blink-features=AutomationControlled",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-infobars",
        ],
        "window_size": {"width": 1920, "height": 1080},
        "disable_security": True,
    }


async def create_stealth_browser():
    """Create, start, and stealth-inject a browser instance.

    Uses a lazy import for ``browser_use.Browser`` to avoid loading the
    heavy dependency at module-import time.

    Returns:
        A started ``Browser`` instance with stealth JS injected via CDP.
    """
    from browser_use import Browser  # noqa: WPS433 — lazy import

    config = get_stealth_browser_config()
    browser = Browser(**config)
    await browser.start()

    # Inject stealth JS via CDP on the initial target.
    # CRITICAL: Page.addScriptToEvaluateOnNewDocument is per-target.
    cdp = await browser.get_or_create_cdp_session()
    await cdp.cdp_client.send.Page.enable(session_id=cdp.session_id)
    await cdp.cdp_client.send.Page.addScriptToEvaluateOnNewDocument(
        params={"source": STEALTH_JS},
        session_id=cdp.session_id,
    )
    logger.info("Browser started with stealth JS injected via CDP")

    return browser


async def create_agent_browser():
    """Create a browser session configured for the browser-use Agent.

    The browser-use library has built-in stealth features:
    - Strips ``--enable-automation`` from Playwright defaults
    - Loads default extensions (uBlock Origin, cookie handler, etc.)
    - Uses CDP (not raw Playwright) reducing detection surface

    We add our custom stealth args and user-agent on top.

    Returns:
        A started ``Browser`` instance ready to pass to ``Agent(browser=...)``.
    """
    from browser_use import Browser  # noqa: WPS433 — lazy import

    config = get_stealth_browser_config()
    browser = Browser(**config)
    await browser.start()
    logger.info("Agent browser started with stealth config")

    return browser


async def take_screenshot(page) -> str | None:
    """Capture a PNG screenshot and return a base64-encoded string.

    Args:
        page: Playwright page object.

    Returns:
        Base64 string of the screenshot, or ``None`` on error.
    """
    try:
        png_bytes = await page.screenshot(type="png", full_page=False)
        return base64.b64encode(png_bytes).decode("ascii")
    except Exception as err:
        logger.warning(f"Screenshot failed: {err}")
        return None


async def close_browser(browser, search_id: str = "") -> None:
    """Safely stop a browser instance, logging any errors.

    Args:
        browser: Browser instance (may be ``None``).
        search_id: Optional search ID for log context.
    """
    if browser is None:
        return
    try:
        await browser.stop()
        prefix = f"[{search_id}] " if search_id else ""
        logger.info(f"{prefix}Browser session stopped")
    except Exception as err:
        logger.warning(f"Error stopping browser: {err}")
