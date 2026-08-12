from hashlib import sha256

from app.models import Artifact, Assignment, Evidence, TaskProgress
from app.store import DemoStore


DEMO_PROJECT_ID = "demo-project"


def seed_demo(store: DemoStore) -> dict:
    store.reset()
    store.project = {
        "id": DEMO_PROJECT_ID,
        "title": "15:30까지 근거 기반 역할 분담 데모 완성",
        "channel_id": "project-room",
        "deadline": "2026-08-12T15:30:00+09:00",
    }
    store.artifacts = [
        Artifact("artifact-1", "task-bot", "demo_v1.zip", "v1", _checksum("demo-v1"), "candidate"),
        Artifact("artifact-2", "task-fixture", "discord_happy_path_v1.json", "v1", _checksum("fixture-v1"), "valid"),
    ]
    store.audit_log.append({"action": "demo_seeded", "actor": "system"})
    return store.snapshot()


def propose_assignments(store: DemoStore) -> list[dict]:
    if store.project is None:
        raise ValueError("Seed a project before requesting assignments.")

    data = [
        Assignment(
            "assignment-a", "task-bot", "Discord Bot·API·웹 통합", "도윤",
            "Bot과 GitHub 연동을 맡겠다는 명시적 약속이 있습니다.",
            [Evidence("ev-0902", "message", "Discord Bot과 GitHub 연동, 배포는 내가 맡을게.", "https://discord.test/channels/project-room/0902")],
            0.96, alternative="민재",
        ),
        Assignment(
            "assignment-b", "task-fixture", "가짜 대화와 파일 fixture", "서연",
            "개인정보 없는 fixture를 만들 수 있다는 약속과 첨부 증거가 있습니다.",
            [Evidence("ev-0903", "message", "가짜 대화 5개와 가짜 파일을 만들 수 있어.", "https://discord.test/channels/project-room/0903")],
            0.94, alternative="유나",
        ),
        Assignment(
            "assignment-c", "task-security", "정답셋과 보안 테스트", "민재",
            "정답셋과 보안 공격 테스트를 맡겠다고 명시했습니다.",
            [Evidence("ev-0904", "message", "정답셋과 보안 공격 테스트를 맡을게.", "https://discord.test/channels/project-room/0904")],
            0.91, blockers=["14:00 수업"], alternative="도윤",
        ),
        Assignment(
            "assignment-unknown", "task-copy", "제출 카피 최종 검수", None,
            "담당자를 정할 행동 증거가 부족합니다. 추가 입력이 필요합니다.", [], 0.0,
            blockers=["needs_input"], alternative=None, status="needs_input",
        ),
    ]
    for item in data:
        previous = store.assignments.get(item.id)
        if previous and previous.status == "confirmed":
            item.status = "confirmed"
    store.assignments = {item.id: item for item in data}
    store.progress = _calculate_progress(store)
    store.audit_log.append({"action": "assignments_proposed", "actor": "system"})
    return [item.to_dict() for item in data]


def apply_constraint(store: DemoStore, assignment_id: str, constraint: str) -> dict:
    assignment = store.assignments.get(assignment_id)
    if assignment is None:
        raise KeyError(assignment_id)
    if not constraint.strip():
        raise ValueError("A constraint is required.")
    assignment.blockers.append(constraint.strip())
    assignment.status = "proposed"
    assignment.reason = f"새 제약을 반영해 사람의 재확인이 필요합니다: {constraint.strip()}"
    store.progress = _calculate_progress(store)
    store.audit_log.append({"action": "constraint_added", "actor": "demo-admin"})
    return assignment.to_dict()


def confirm_assignment(store: DemoStore, assignment_id: str, actor: str) -> dict:
    assignment = store.assignments.get(assignment_id)
    if assignment is None:
        raise KeyError(assignment_id)
    if assignment.owner is None:
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
            state, percent, blocker, next_action = "unknown", None, "근거 부족", "담당 근거를 추가하세요."
        elif assignment.blockers:
            state, percent, blocker, next_action = "blocked", 35, assignment.blockers[0], "일정 제약을 해결하거나 대안을 확인하세요."
        elif assignment.status != "confirmed":
            state, percent, blocker, next_action = "in_progress", 40, None, "사람이 배정을 확인하세요."
        elif not files:
            state, percent, blocker, next_action = "review_pending", 80, "필수 파일 없음", "필수 산출물을 업로드하세요."
        else:
            state, percent, blocker, next_action = "review_pending", 90, "테스트·완료 승인 대기", "테스트 후 완료를 승인하세요."
        result.append(TaskProgress(assignment.task_id, assignment.task, state, percent, [e.id for e in assignment.evidence], blocker, next_action))
    return result


def _checksum(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()[:12]
