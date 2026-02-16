"""Tests for app.constants.stealth — user-agent rotation and stealth JS."""

from __future__ import annotations

from app.constants.stealth import STEALTH_JS, USER_AGENTS


class TestUserAgents:
    """Verify the user-agent list is well-formed."""

    def test_is_list(self):
        assert isinstance(USER_AGENTS, list)

    def test_has_at_least_three(self):
        assert len(USER_AGENTS) >= 3

    def test_all_strings(self):
        for ua in USER_AGENTS:
            assert isinstance(ua, str)

    def test_all_contain_mozilla(self):
        for ua in USER_AGENTS:
            assert "Mozilla" in ua

    def test_includes_chrome(self):
        chrome_uas = [ua for ua in USER_AGENTS if "Chrome" in ua]
        assert len(chrome_uas) >= 1

    def test_includes_firefox(self):
        firefox_uas = [ua for ua in USER_AGENTS if "Firefox" in ua]
        assert len(firefox_uas) >= 1

    def test_includes_safari(self):
        safari_uas = [ua for ua in USER_AGENTS if "Safari" in ua]
        assert len(safari_uas) >= 1

    def test_includes_windows(self):
        win_uas = [ua for ua in USER_AGENTS if "Windows" in ua]
        assert len(win_uas) >= 1

    def test_includes_mac(self):
        mac_uas = [ua for ua in USER_AGENTS if "Macintosh" in ua]
        assert len(mac_uas) >= 1


class TestStealthJs:
    """Verify the stealth JavaScript snippet."""

    def test_is_string(self):
        assert isinstance(STEALTH_JS, str)

    def test_not_empty(self):
        assert len(STEALTH_JS) > 100

    def test_overrides_webdriver(self):
        assert "navigator" in STEALTH_JS
        assert "webdriver" in STEALTH_JS

    def test_sets_chrome_runtime(self):
        assert "window.chrome" in STEALTH_JS

    def test_overrides_permissions(self):
        assert "permissions" in STEALTH_JS

    def test_overrides_plugins(self):
        assert "plugins" in STEALTH_JS

    def test_overrides_languages(self):
        assert "languages" in STEALTH_JS
        assert "en-US" in STEALTH_JS
