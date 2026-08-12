import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    allowed_channel_ids: tuple[str, ...] = tuple(
        item.strip()
        for item in os.getenv("ALLOWED_CHANNEL_IDS", "project-room").split(",")
        if item.strip()
    )
    retention_hours: int = int(os.getenv("RETENTION_HOURS", "24"))


settings = Settings()
