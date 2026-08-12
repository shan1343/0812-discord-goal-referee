import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    allowed_channel_ids: tuple[str, ...] = tuple(
        item.strip()
        for item in os.getenv("ALLOWED_CHANNEL_IDS", "project-room").split(",")
        if item.strip()
    )
    retention_hours: int = int(os.getenv("RETENTION_HOURS", "24"))
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-5.6-terra")
    openai_timeout_seconds: int = int(os.getenv("OPENAI_TIMEOUT_SECONDS", "60"))
    openai_max_output_tokens: int = int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "2800"))


settings = Settings()
