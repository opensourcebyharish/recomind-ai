"""Logging configuration for the RecoMind AI backend."""

from __future__ import annotations

import logging

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def configure_logging(level: str = "INFO") -> None:
    """Configure standard-library logging without duplicating handlers."""

    log_level = getattr(logging, level.upper(), logging.INFO)
    root_logger = logging.getLogger()

    if not root_logger.handlers:
        logging.basicConfig(
            level=log_level,
            format=LOG_FORMAT,
            datefmt=DATE_FORMAT,
        )
    else:
        root_logger.setLevel(log_level)

    # Keep noisy third-party loggers readable during local development.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a module-scoped logger."""

    return logging.getLogger(name)
