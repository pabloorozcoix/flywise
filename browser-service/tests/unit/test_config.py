"""Tests for app.config — Settings defaults and env overrides."""

from __future__ import annotations

import pytest


class TestSettingsDefaults:
    """Verify default setting values match expected Docker Compose defaults."""

    def test_ollama_host_default(self):
        from app.config import Settings

        s = Settings()
        assert s.ollama_host == "http://ollama:11434"

    def test_ollama_model_default(self):
        from app.config import Settings

        s = Settings()
        assert s.ollama_model == "qwen3:8b"

    def test_openai_model_default(self):
        from app.config import Settings

        s = Settings()
        assert s.openai_model == "gpt-4.1-mini"

    def test_openai_api_key_default_empty(self):
        from app.config import Settings

        s = Settings()
        assert s.openai_api_key == ""

    def test_nextjs_callback_url_default(self):
        from app.config import Settings

        s = Settings()
        assert s.nextjs_callback_url == "http://nextjs:3000/api/callback/search-complete"

    def test_max_concurrent_searches_default(self):
        from app.config import Settings

        s = Settings()
        assert s.max_concurrent_searches == 3


class TestSettingsEnvOverride:
    """Verify settings can be overridden via environment variables."""

    def test_ollama_host_override(self, monkeypatch):
        monkeypatch.setenv("OLLAMA_HOST", "http://custom:9999")
        from app.config import Settings

        s = Settings()
        assert s.ollama_host == "http://custom:9999"

    def test_ollama_model_override(self, monkeypatch):
        monkeypatch.setenv("OLLAMA_MODEL", "llama3:70b")
        from app.config import Settings

        s = Settings()
        assert s.ollama_model == "llama3:70b"

    def test_max_concurrent_searches_override(self, monkeypatch):
        monkeypatch.setenv("MAX_CONCURRENT_SEARCHES", "10")
        from app.config import Settings

        s = Settings()
        assert s.max_concurrent_searches == 10

    def test_openai_api_key_override(self, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test123")
        from app.config import Settings

        s = Settings()
        assert s.openai_api_key == "sk-test123"


class TestGetSettings:
    """Verify the cached singleton factory."""

    def test_get_settings_returns_settings_instance(self):
        from app.config import Settings, get_settings

        result = get_settings()
        assert isinstance(result, Settings)

    def test_get_settings_caches_result(self):
        from app.config import get_settings

        first = get_settings()
        second = get_settings()
        assert first is second
