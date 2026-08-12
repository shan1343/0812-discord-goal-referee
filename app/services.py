"""Project, evidence and role-proposal services.

The Discord path is deliberately deterministic.  A person becomes a proposed
owner only after writing an explicit promise that clearly matches one task.
"""

from __future__ import annotations

import re
from hashlib import sha256

from app.classification import classify_discord_message
from app.models import Artifact, Assignment, Evidence, TaskProgress
from app.openai_roles import analyze_discord_project
from app.store import DemoStore


DEMO_PROJECT_ID = "demo-project"


def ingest_discord_event(store: DemoStore, event: dict) -> dict:
    """Store one normalized, allowlisted Discord message idempotently."""
    if any(item["message_id"] == event["message_id"] for item in store.discord_events):
        return {"accepted": True, "duplicate": True, "classification": None}
    classified = classify_discord_message(event)
    store.discord_events.append(event)
    store.classifications.append(classified.to_dict())
    store.audit_log.append({"action": "discord_event_classified", "actor": event["author_id"]})
    return {"accepted": True, "duplicate": False, "classification": classified.to_dict()}


def create_discord_project(store: DemoStore, project: dict) -> dict:
    """Create a task list that will be matched against Discord evidence."""
    if store.project is not None:
        raise ValueError("A project already exists. Reset the demo store before creating another project.")
    task_ids = [task["id"] for task in project["tasks"]]
    if len(task_ids) != len(set(task_ids)):
        raise ValueError("Each task id must be unique.")
    store.project = {
        "id": project["id"],
        "title": project["title"],
        "channel_id": project["channel_id"],
        "deadline": project.get("deadline"),
        "tasks": project["tasks"],
        "source": "discord",
    }
    store.audit_log.append({"action": "discord_project_created", "actor": "project-admin"})
    return store.project


def seed_demo(store: DemoStore) -> dict:
    store.reset()
    store.project = {
        "id": DEMO_PROJECT_ID,
        "title": "Evidence-based role proposal demo",
        "channel_id": "project-room",
        "deadline": "2026-08-12T15:30:00+09:00",
        "source": "demo",
    }
    store.artifacts = [
        Artifact("artifact-1", "task-bot", "demo_v1.zip", "v1", _checksum("demo-v1"), "candidate"),
        Artifact("artifact-2", "task-fixture", "discord_happy_path_v1.json", "v1", _checksum("fixture-v1"), "valid"),
    ]
    store.audit_log.append({"action": "demo_seeded", "actor": "system"})
    return store.snapshot()


def propose_assignments(store: DemoStore) -> list[dict]:
    if store.project is None:
        raise ValueError("Create or seed a project before requesting assignments.")
    if store.project.get("source") == "discord":
        data = _propose_from_discord(store)
    else:
        data = _demo_assignments()

    for item in data:
        previous = store.assignments.get(item.id)
        if previous and previous.status == "confirmed" and previous.owner_id == item.owner_id:
            item.status = "confirmed"
    store.assignments = {item.id: item for item in data}
    store.progress = _calculate_progress(store)
    store.audit_log.append({"action": "assignments_proposed", "actor": "system"})
    return [item.to_dict() for item in data]


def analyze_and_store_role_plan(store: DemoStore) -> dict:
    if store.project is None:
        raise ValueError("Create a Discord project before requesting role analysis.")
    project = store.project
    events = [item for item in store.discord_events if item["channel_id"] == project["channel_id"]]
    result = analyze_discord_project(events, project["title"], project.get("deadline"))
    store.role_plan = result
    store.audit_log.append({"action": "openai_role_plan_created", "actor": "system"})
    return result


def _propose_from_discord(store: DemoStore) -> list[Assignment]:
    project = store.project
    assert project is not None
    messages = [
        item for item in store.classifications
        if item["category"] == "work_promise"
        and any(event["message_id"] == item["message_id"] and event["channel_id"] == project["channel_id"] for event in store.discord_events)
    ]
    constraints_by_author: dict[str, list[str]] = {}
    for item in store.classifications:
        if item["category"] == "constraint":
            constraints_by_author.setdefault(item["author_id"], []).append(item["constraint"] or item["text"])

    result: list[Assignment] = []
    for task in project["tasks"]:
        matches = [item for item in messages if _matches_task(item["task_text"] or "", task, len(project["tasks"]) == 1)]
        by_author: dict[str, dict] = {}
        for item in matches:
            by_author.setdefault(item["author_id"], item)

        if len(by_author) == 1:
            message = next(iter(by_author.values()))
            owner_id = message["author_id"]
            owner = message.get("author_name") or owner_id
            evidence = [Evidence(
                id=f"discord-{message['message_id']}",
                type="discord_message",
                quote=message["text"],
                source_url=message.get("source_url") or _source_ref(project["channel_id"], message["message_id"]),
            )]
            blockers = constraints_by_author.get(owner_id, [])
            reason = "Explicit Discord work promise matched this task; human confirmation is still required."
            result.append(Assignment(
                id=f"assignment-{task['id']}", task_id=task["id"], task=task["title"], owner=owner,
                owner_id=owner_id, reason=reason, evidence=evidence, confidence=1.0, blockers=blockers,
            ))
        elif len(by_author) > 1:
            result.append(Assignment(
                id=f"assignment-{task['id']}", task_id=task["id"], task=task["title"], owner=None,
                owner_id=None, reason="Multiple explicit promises match this task. Choose an owner in Discord.",
                evidence=[], confidence=0.0, blockers=["needs_input"], status="needs_input",
            ))
        else:
            result.append(Assignment(
                id=f"assignment-{task['id']}", task_id=task["id"], task=task["title"], owner=None,
                owner_id=None, reason="No explicit Discord promise clearly matched this task.",
                evidence=[], confidence=0.0, blockers=["needs_input"], status="needs_input",
            ))
    return result


def _matches_task(promise: str, task: dict, allow_single_task: bool) -> bool:
    if allow_single_task and promise.strip():
        return True
    promise_key = _compact(promise)
    if not promise_key:
        return False
    title = task["title"]
    keywords = task.get("keywords", [])
    phrases = [title, *keywords]
    for phrase in phrases:
        key = _compact(phrase)
        if len(key) >= 2 and (key in promise_key or promise_key in key):
            return True
    promise_terms = _terms(promise)
    for keyword in keywords:
        keyword_terms = _terms(keyword)
        if keyword_terms and keyword_terms.issubset(promise_terms):
            return True
    title_overlap = promise_terms.intersection(_terms(title))
    if len(title_overlap) >= 2:
        return True
    return False


def _terms(text: str) -> set[str]:
    return {term.lower() for term in re.findall(r"[A-Za-z0-9\uac00-\ud7a3]{2,}", text)}


def _compact(text: str) -> str:
    return "".join(re.findall(r"[A-Za-z0-9\uac00-\ud7a3]+", text)).lower()


def _source_ref(channel_id: str, message_id: str) -> str:
    return f"discord-message#{channel_id}/{message_id}"


def _demo_assignments() -> list[Assignment]:
    return [
        Assignment("assignment-a", "task-bot", "Discord Bot/API/web integration", "Doyun", "Explicit integration promise.", [Evidence("ev-0902", "message", "I will handle bot integration.", "https://discord.test/channels/project-room/0902")], 1.0, owner_id="doyun"),
        Assignment("assignment-b", "task-fixture", "Dummy data fixture", "Seyeon", "Explicit fixture promise.", [Evidence("ev-0903", "message", "I will make the fixture.", "https://discord.test/channels/project-room/0903")], 1.0, owner_id="seyeon"),
        Assignment("assignment-c", "task-security", "Answer key and security test", "Minjae", "Explicit testing promise.", [Evidence("ev-0904", "message", "I will test security.", "https://discord.test/channels/project-room/0904")], 1.0, blockers=["14:00 class"], owner_id="minjae"),
        Assignment("assignment-unknown", "task-copy", "Final copy review", None, "No explicit evidence; input is required.", [], 0.0, blockers=["needs_input"], status="needs_input"),
    ]


def apply_constraint(store: DemoStore, assignment_id: str, constraint: str) -> dict:
    assignment = store.assignments.get(assignment_id)
    if assignment is None:
        raise KeyError(assignment_id)
    if not constraint.strip():
        raise ValueError("A constraint is required.")
    assignment.blockers.append(constraint.strip())
    assignment.status = "proposed"
    assignment.reason = f"Constraint added; reconfirmation is required: {constraint.strip()}"
    store.progress = _calculate_progress(store)
    store.audit_log.append({"action": "constraint_added", "actor": "project-admin"})
    return assignment.to_dict()


def confirm_assignment(store: DemoStore, assignment_id: str, actor: str) -> dict:
    assignment = store.assignments.get(assignment_id)
    if assignment is None:
        raise KeyError(assignment_id)
    if assignment.owner is None or not assignment.evidence:
        raise ValueError("An assignment without evidence cannot be confirmed.")
    assignment.status = "confirmed"
    store.progress = _calculate_progress(store)
    store.audit_log.append({"action": "assignment_confirmed", "actor": actor})
    return assignment.to_dict()


def _calculate_progress(store: DemoStore) -> list[TaskProgress]:
    result: list[TaskProgress] = []
    for assignment in store.assignments.values():
        files = [item for item in store.artifacts if item.task_id == assignment.task_id]
        if assignment.owner is None:
            state, percent, blocker, next_action = "unknown", None, "evidence missing", "Ask for an explicit owner confirmation."
        elif assignment.blockers:
            state, percent, blocker, next_action = "blocked", 35, assignment.blockers[0], "Resolve the stated constraint and reconfirm."
        elif assignment.status != "confirmed":
            state, percent, blocker, next_action = "in_progress", 40, None, "Confirm the proposed assignment."
        elif not files:
            state, percent, blocker, next_action = "review_pending", 80, "required file missing", "Upload the required deliverable."
        else:
            state, percent, blocker, next_action = "review_pending", 90, "review pending", "Confirm the deliverable review."
        result.append(TaskProgress(assignment.task_id, assignment.task, state, percent, [e.id for e in assignment.evidence], blocker, next_action))
    return result


def _checksum(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()[:12]
