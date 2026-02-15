"""Application configuration via environment variables.

Uses pydantic-settings to load and validate all service configuration
from environment variables with sensible defaults for Docker Compose.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Service-wide settings loaded from environment variables.

    Field names map to uppercase env vars automatically:
      ollama_host  ->  OLLAMA_HOST
      ollama_model ->  OLLAMA_MODEL
      ...
    """

    model_config = SettingsConfigDict(
        env_prefix="",
        case_sensitive=False,
    )

    # ── Ollama LLM ──────────────────────────────────────────────
    ollama_host: str = "http://ollama:11434"
    ollama_model: str = "qwen3:8b"

    # ── OpenAI (optional fallback) ──────────────────────────────
    openai_model: str = "gpt-4.1-mini"
    openai_api_key: str = ""

    # ── Inter-service communication ─────────────────────────────
    nextjs_callback_url: str = (
        "http://nextjs:3000/api/callback/search-complete"
    )

    # ── Rate limiting ───────────────────────────────────────────
    max_concurrent_searches: int = 3


@lru_cache
def get_settings() -> Settings:
    """Return a cached settings singleton."""
    return Settings()
