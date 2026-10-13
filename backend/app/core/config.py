"""Core configuration and settings for TriageGuard."""

from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Locate root .env relative to this file
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_ROOT_DIR = _BACKEND_DIR.parent
_ENV_PATH = _ROOT_DIR / ".env"

if _ENV_PATH.exists():
    load_dotenv(dotenv_path=_ENV_PATH)
else:
    load_dotenv()


class Settings(BaseSettings):
    """Application configuration settings parsed from environment variables."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_PATH) if _ENV_PATH.exists() else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server settings
    app_env: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,*"

    # Supabase Database Configuration
    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None
    supabase_service_role_key: Optional[str] = None
    supabase_db_url: Optional[str] = None
    supabase_enabled: bool = True
    supabase_table_tickets: str = "tickets"
    supabase_table_sanitization_logs: str = "sanitization_logs"

    # ML Model Settings
    hf_home: Optional[str] = None
    hf_token: Optional[str] = None
    prompt_guard_mock: bool = False
    router_mock: bool = False

    # Routing Thresholds
    conf_category_min: float = 0.80
    conf_urgency_min: float = 0.75

    # LLM Settings (OpenRouter only)
    llm_provider: str = "openrouter"
    openrouter_api_key: Optional[str] = None
    openrouter_model: str = "meta-llama/llama-3.3-70b-instruct"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    llm_timeout_s: int = 20




    @property
    def cors_origins_list(self) -> List[str]:
        """Parsed list of allowed CORS origins."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_supabase_configured(self) -> bool:
        """Returns True if valid non-placeholder Supabase credentials are configured."""
        if not self.supabase_enabled:
            return False
        if not self.supabase_url or not self.supabase_key:
            return False
        # Disallow default templates/placeholders
        placeholder_indicators = [
            "your-project-ref",
            "your-project-id",
            "your-supabase",
            "your-anon-or-service-key",
            "example.supabase.co",
        ]
        url = self.supabase_url.strip().lower()
        key = self.supabase_key.strip().lower()
        if any(ph in url for ph in placeholder_indicators):
            return False
        if any(ph in key for ph in placeholder_indicators):
            return False
        return True


@lru_cache()
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()
