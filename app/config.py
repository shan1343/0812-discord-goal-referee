import json
import os
from pathlib import Path
from dataclasses import dataclass
from threading import RLock
from typing import Any


class GoalRefereeResultStore:
    """Small durable store for the latest result per Discord channel."""

    def __init__(self, path: str) -> None:
        self._path = Path(path)
        self._lock = RLock()

    def put(self, channel_id: str, payload: dict[str, Any]) -> None:
        with self._lock:
            results = self._read()
            results[channel_id] = payload
            self._path.parent.mkdir(parents=True, exist_ok=True)
            temporary = self._path.with_suffix(".tmp")
            temporary.write_text(json.dumps(results, ensure_ascii=False), encoding="utf-8")
            temporary.replace(self._path)

    def latest(self, channel_id: str | None = None) -> dict[str, Any] | None:
        with self._lock:
            results = self._read()
            if channel_id:
                return results.get(channel_id)
            if not results:
                return None
            return max(results.values(), key=lambda item: item.get("generatedAt", ""))

    def _read(self) -> dict[str, dict[str, Any]]:
        if not self._path.exists():
            return {}
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        return data if isinstance(data, dict) else {}

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
    goal_referee_ingest_token: str = os.getenv("GOAL_REFEREE_INGEST_TOKEN", "")
    goal_referee_results_path: str = os.getenv(
        "GOAL_REFEREE_RESULTS_PATH", "./data/goal-referee-results.json"
    )
    dashboard_cors_origins: tuple[str, ...] = tuple(
        item.strip().rstrip("/")
        for item in os.getenv("DASHBOARD_CORS_ORIGINS", "").split(",")
        if item.strip()
    )


settings = Settings()
goal_referee_results = GoalRefereeResultStore(settings.goal_referee_results_path)
