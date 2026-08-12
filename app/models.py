from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Evidence:
    id: str
    type: str
    quote: str
    source_url: str


@dataclass
class Assignment:
    id: str
    task_id: str
    task: str
    owner: str | None
    reason: str
    evidence: list[Evidence]
    confidence: float
    blockers: list[str] = field(default_factory=list)
    alternative: str | None = None
    status: str = "proposed"
    owner_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Artifact:
    id: str
    task_id: str
    file_name: str
    version: str
    checksum: str
    validation_status: str


@dataclass
class TaskProgress:
    task_id: str
    task: str
    state: str
    percent: int | None
    evidence_ids: list[str]
    blocker: str | None
    next_action: str
