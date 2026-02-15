"""Structured logging configuration for the browser-use service.

Provides a single ``configure_logging`` call (run once at startup) and
a ``get_logger`` factory that returns consistently-named child loggers.
"""

import logging
import sys


def configure_logging(level: int = logging.INFO) -> None:
    """Configure application-wide logging format and level.

    Should be called once during application startup (lifespan event).
    """
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stdout,
        force=True,
    )
    # Quiet noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger under the ``browser-use`` namespace.

    Example::

        logger = get_logger("search")  # -> "browser-use.search"
    """
    return logging.getLogger(f"browser-use.{name}")
