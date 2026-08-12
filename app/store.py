from dataclasses import asdict
from threading import RLock
from typing import Any

from app.models import Artifact, Assignment, TaskProgress


class DemoStore:
    def __init__(self) -> None:
        self._lock = RLock()
        self.reset()

    def reset(self) -> None:
        with self._lock:
            self.project: dict[str, Any] | None = None
            self.assignments: dict[str, Assignment] = {}
            self.artifacts: list[Artifact] = []
            self.progress: list[TaskProgress] = []
            self.audit_log: list[dict[str, str]] = []

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "project": self.project,
                "assignments": [item.to_dict() for item in self.assignments.values()],
                "artifacts": [asdict(item) for item in self.artifacts],
                "progress": [asdict(item) for item in self.progress],
                "audit_log": list(self.audit_log),
            }


store = DemoStore()
