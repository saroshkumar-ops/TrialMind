"""
utils/config.py
---------------
Centralised configuration loaded from .env via python-dotenv.
All other modules import settings from here — never read os.environ directly.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file that lives next to app.py (project root of aiml/)
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=False)


class Settings:
    """Application-wide settings resolved at import time."""

    # Groq
    groq_api_key: str = os.environ.get("GROQ_API_KEY", "")
    groq_model: str = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

    # App
    app_env: str = os.environ.get("APP_ENV", "development")
    log_level: str = os.environ.get("LOG_LEVEL", "INFO").upper()

    # Paths
    base_dir: Path = Path(__file__).resolve().parent.parent
    models_dir: Path = base_dir / "models"

    @property
    def risk_model_path(self) -> Path:
        return self.models_dir / "risk_model.pkl"

    @property
    def preprocessor_path(self) -> Path:
        return self.models_dir / "preprocessor.pkl"

    @property
    def feature_names_path(self) -> Path:
        return self.models_dir / "feature_names.pkl"

    @property
    def groq_configured(self) -> bool:
        return bool(self.groq_api_key and self.groq_api_key != "your_groq_api_key_here")


# Singleton
settings = Settings()
