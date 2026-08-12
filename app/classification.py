"""Small, explainable classifier for opt-in Discord project messages.

It intentionally recognises only an explicit promise or stated constraint.
It never infers a member's ability, effort, personality, or contribution.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass


# Korean expressions are written as Unicode escapes so this module remains
# portable across Windows terminals with different code pages.
PROMISE_VERBS = (
    r"\ub9e1\uc744\uac8c",  # will take it
    r"\ub9e1\uaca0\uc2b5\ub2c8\ub2e4",
    r"\ud560\uac8c",
    r"\ud558\uaca0\uc2b5\ub2c8\ub2e4",
    r"\uc900\ube44\ud560\uac8c",
    r"\ub9cc\ub4e4\uac8c",
    r"\uc62c\ub9b4\uac8c",
    r"\ud14c\uc2a4\ud2b8\ud560\uac8c",
    r"\ub9e1\uc544",  # informal: I will take it
    r"\ud560\uac8c\uc694",
)
PROMISE_PATTERN = re.compile(
    r"^(?P<task>.{1,300}?)(?:\uc740|\ub294|\uc744|\ub97c)?\s*"
    r"(?:\ub0b4\uac00|\uc81c\uac00)?\s*(?:" + "|".join(PROMISE_VERBS) + r")(?:\uc694)?[.!?\s]*$",
    re.IGNORECASE,
)
ENGLISH_PROMISE_PATTERN = re.compile(
    r"^(?P<task>.{1,300}?)\s+(?:i\s+(?:will|can)|i'll|i can)\s+"
    r"(?:take|handle|own|do|prepare|build|deploy|test|organize).*$",
    re.IGNORECASE,
)
CONSTRAINT_MARKERS = (
    "\ubd88\uac00", "\uc5b4\ub824\uc6cc", "\uc218\uc5c5", "\ud68c\uc758", "\ub9c8\uac10", "\uc774\ud6c4", "\uc804\uc5d0",
    "cannot", "can't", "unavailable", "deadline conflict",
)
COMMAND_MARKERS = ("/assign", "\uc5ed\ud560 \ubc30\uc815", "\ubd84\ub2f4\ud574", "assign roles")


@dataclass(frozen=True)
class ClassifiedMessage:
    message_id: str
    author_id: str
    author_name: str | None
    created_at: str | None
    text: str
    source_url: str | None
    category: str
    task_text: str | None = None
    constraint: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def classify_discord_message(event: dict) -> ClassifiedMessage:
    """Classify one normalized message without making a person-level judgment."""
    content = str(event.get("content", "")).strip()
    lower = content.lower()
    common = {
        "message_id": str(event["message_id"]),
        "author_id": str(event["author_id"]),
        "author_name": event.get("author_name"),
        "created_at": event.get("created_at"),
        "text": content,
        "source_url": event.get("source_url"),
    }

    if any(marker in lower for marker in COMMAND_MARKERS):
        return ClassifiedMessage(category="assignment_request", **common)

    for pattern in (PROMISE_PATTERN, ENGLISH_PROMISE_PATTERN):
        match = pattern.match(content)
        if match:
            task = re.sub(r"\s+", " ", match.group("task")).strip(" ,.!?")
            if task:
                return ClassifiedMessage(category="work_promise", task_text=task, **common)

    if any(marker in lower for marker in CONSTRAINT_MARKERS):
        return ClassifiedMessage(category="constraint", constraint=content, **common)
    if lower.startswith("/progress") or "\uc9c4\ud589\ub960" in content or "progress" in lower:
        return ClassifiedMessage(category="progress_request", **common)
    return ClassifiedMessage(category="other", **common)
