"""Tests for app.logger — Structured logging configuration."""

from __future__ import annotations

import logging

from app.logger import configure_logging, get_logger


class TestConfigureLogging:
    """Verify logging configuration."""

    def test_configure_logging_sets_root_level(self):
        configure_logging(level=logging.DEBUG)
        root = logging.getLogger()
        assert root.level == logging.DEBUG

    def test_configure_logging_defaults_to_info(self):
        configure_logging()
        root = logging.getLogger()
        assert root.level == logging.INFO

    def test_configure_logging_quiets_httpx(self):
        configure_logging()
        httpx_logger = logging.getLogger("httpx")
        assert httpx_logger.level == logging.WARNING

    def test_configure_logging_quiets_uvicorn_access(self):
        configure_logging()
        uvicorn_logger = logging.getLogger("uvicorn.access")
        assert uvicorn_logger.level == logging.WARNING


class TestGetLogger:
    """Verify named logger factory."""

    def test_get_logger_returns_logger(self):
        logger = get_logger("test")
        assert isinstance(logger, logging.Logger)

    def test_get_logger_has_correct_name(self):
        logger = get_logger("search")
        assert logger.name == "browser-use.search"

    def test_get_logger_with_dotted_name(self):
        logger = get_logger("routes.health")
        assert logger.name == "browser-use.routes.health"

    def test_get_logger_returns_different_instances_for_different_names(self):
        a = get_logger("a")
        b = get_logger("b")
        assert a is not b
        assert a.name != b.name
