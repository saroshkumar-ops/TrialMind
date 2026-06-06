"""
utils/logger.py
---------------
Centralised logging configuration for the TrialMind AIML service.
All modules obtain their logger via get_logger(__name__).
"""

import logging
import sys
from typing import Optional

from utils.config import settings


def _configure_root_logger() -> None:
    """Configure the root logger once at import time."""
    log_level = getattr(logging, settings.log_level, logging.INFO)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    # Stdout handler
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setLevel(log_level)
    stdout_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(log_level)

    # Avoid adding duplicate handlers when module is reimported
    if not root.handlers:
        root.addHandler(stdout_handler)

    # Suppress noisy third-party loggers
    for noisy in ("httpx", "httpcore", "groq", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


_configure_root_logger()


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """Return a named logger inheriting the root configuration."""
    return logging.getLogger(name or "trialmind")
