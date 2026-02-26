"""Integration tests for app.services.browser — stealth config and lifecycle."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.constants.stealth import USER_AGENTS
from app.services.browser import (
    close_browser,
    create_agent_browser,
    get_stealth_browser_config,
    take_screenshot,
)


class TestGetStealthBrowserConfig:
    """Verify the pure-function config builder."""

    def test_returns_dict(self):
        config = get_stealth_browser_config()
        assert isinstance(config, dict)

    def test_headless_is_true(self):
        config = get_stealth_browser_config()
        assert config["headless"] is True

    def test_user_agent_from_list(self):
        config = get_stealth_browser_config()
        assert config["user_agent"] in USER_AGENTS

    def test_args_is_list(self):
        config = get_stealth_browser_config()
        assert isinstance(config["args"], list)
        assert len(config["args"]) >= 1

    def test_disable_automation_controlled(self):
        config = get_stealth_browser_config()
        assert any("AutomationControlled" in a for a in config["args"])

    def test_window_size_set(self):
        config = get_stealth_browser_config()
        assert config["window_size"]["width"] == 1920
        assert config["window_size"]["height"] == 1080

    def test_disable_security_enabled(self):
        config = get_stealth_browser_config()
        assert config["disable_security"] is True


class TestTakeScreenshot:
    """Verify screenshot capture."""

    @pytest.mark.asyncio
    async def test_returns_base64_on_success(self):
        page = AsyncMock()
        page.screenshot.return_value = b"\x89PNG\r\n\x1a\n"
        result = await take_screenshot(page)
        assert result is not None
        assert isinstance(result, str)

    @pytest.mark.asyncio
    async def test_returns_none_on_error(self):
        page = AsyncMock()
        page.screenshot.side_effect = RuntimeError("Page crashed")
        result = await take_screenshot(page)
        assert result is None


class TestCloseBrowser:
    """Verify safe browser shutdown."""

    @pytest.mark.asyncio
    async def test_stops_browser(self):
        browser = AsyncMock()
        await close_browser(browser, search_id="test-1")
        browser.stop.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_none_browser_is_noop(self):
        # Should not raise
        await close_browser(None, search_id="test-2")

    @pytest.mark.asyncio
    async def test_stop_error_logged_not_raised(self):
        browser = AsyncMock()
        browser.stop.side_effect = RuntimeError("Already stopped")
        # Should not raise
        await close_browser(browser, search_id="test-3")


class TestCreateStealthBrowser:
    """Verify browser creation with mocked browser_use.Browser."""

    @pytest.mark.asyncio
    async def test_creates_and_starts_browser(self):
        mock_browser = AsyncMock()
        mock_cdp = AsyncMock()
        mock_browser.get_or_create_cdp_session.return_value = mock_cdp

        with patch(
            "browser_use.Browser",
            return_value=mock_browser,
        ):
            from app.services.browser import create_stealth_browser

            result = await create_stealth_browser()
            assert result is mock_browser
            mock_browser.start.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_injects_stealth_js(self):
        mock_browser = AsyncMock()
        mock_cdp = AsyncMock()
        mock_browser.get_or_create_cdp_session.return_value = mock_cdp

        with patch(
            "browser_use.Browser",
            return_value=mock_browser,
        ):
            from app.services.browser import create_stealth_browser

            await create_stealth_browser()
            mock_cdp.cdp_client.send.Page.enable.assert_awaited_once()
            mock_cdp.cdp_client.send.Page.addScriptToEvaluateOnNewDocument.assert_awaited_once()


class TestCreateAgentBrowser:
    """Verify agent browser creation (no CDP stealth injection)."""

    @pytest.mark.asyncio
    async def test_creates_and_starts_browser(self):
        mock_browser = AsyncMock()

        with patch(
            "browser_use.Browser",
            return_value=mock_browser,
        ):
            result = await create_agent_browser()
            assert result is mock_browser
            mock_browser.start.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_does_not_inject_cdp_stealth(self):
        """Agent browser relies on library stealth, no manual CDP injection."""
        mock_browser = AsyncMock()

        with patch(
            "browser_use.Browser",
            return_value=mock_browser,
        ):
            await create_agent_browser()
            mock_browser.get_or_create_cdp_session.assert_not_awaited()
