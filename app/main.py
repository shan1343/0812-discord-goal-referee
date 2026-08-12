from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.config import goal_referee_results, settings
from app.services import (
    apply_constraint,
    confirm_assignment,
    create_discord_project,
    ingest_discord_event,
    analyze_and_store_role_plan,
    propose_assignments,
    seed_demo,
)
from app.store import store


app = FastAPI(title="Discord Goal Referee", version="0.1.0")
STATIC_DIR = Path(__file__).parent / "static"

if settings.dashboard_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.dashboard_cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )


class ConfirmRequest(BaseModel):
    assignment_id: str
    actor: str = Field(min_length=1, max_length=80)


class ConstraintRequest(BaseModel):
    assignment_id: str
    constraint: str = Field(min_length=1, max_length=300)


class DiscordAttachment(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    content_type: str | None = Field(default=None, max_length=100)
    size: int = Field(ge=0, le=25 * 1024 * 1024)


class DiscordEventRequest(BaseModel):
    channel_id: str
    message_id: str = Field(min_length=1, max_length=100)
    author_id: str = Field(min_length=1, max_length=100)
    author_name: str | None = Field(default=None, max_length=100)
    content: str = Field(default="", max_length=4000)
    created_at: str | None = Field(default=None, max_length=64)
    source_url: str | None = Field(default=None, max_length=500)
    is_bot: bool = False
    attachments: list[DiscordAttachment] = Field(default_factory=list, max_length=10)


class ProjectTaskRequest(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=300)
    keywords: list[str] = Field(default_factory=list, max_length=12)


class DiscordProjectRequest(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    channel_id: str = Field(min_length=1, max_length=100)
    deadline: str | None = Field(default=None, max_length=64)
    tasks: list[ProjectTaskRequest] = Field(min_length=1, max_length=20)


class GoalRefereeTaskResult(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    ownerId: str | None = Field(default=None, max_length=100)
    ownerName: str | None = Field(default=None, max_length=100)
    reason: str = Field(min_length=1, max_length=350)
    evidenceMessageIds: list[str] = Field(default_factory=list, max_length=4)
    status: str = Field(pattern="^(proposed|needs_input)$")


class GoalRefereeResultRequest(BaseModel):
    schemaVersion: str = Field(pattern="^1\\.0$")
    guildId: str = Field(min_length=1, max_length=100)
    channelId: str = Field(min_length=1, max_length=100)
    generatedAt: str = Field(min_length=1, max_length=80)
    summary: str = Field(min_length=1, max_length=500)
    tasks: list[GoalRefereeTaskResult] = Field(default_factory=list, max_length=8)
    questions: list[str] = Field(default_factory=list, max_length=5)
    sourceMessageCount: int = Field(ge=1, le=50)


def require_ingest_token(authorization: str | None = Header(default=None)) -> None:
    expected = settings.goal_referee_ingest_token
    if not expected or authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Invalid dashboard ingest token.")


@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "bot": "external",
        "model": settings.openai_model,
        "database": "memory",
        "environment": settings.app_env,
        "dashboard_sync": "configured" if settings.goal_referee_ingest_token else "not_configured",
    }


@app.post("/api/demo/seed")
def demo_seed() -> dict:
    return seed_demo(store)


@app.post("/api/assign")
def assign() -> dict:
    try:
        project_id = store.project["id"] if store.project else None
        return {"project_id": project_id, "assignments": propose_assignments(store)}
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/confirm")
def confirm(request: ConfirmRequest) -> dict:
    try:
        return confirm_assignment(store, request.assignment_id, request.actor)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Assignment not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/reassign")
def reassign(request: ConstraintRequest) -> dict:
    try:
        return apply_constraint(store, request.assignment_id, request.constraint)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Assignment not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/discord/events")
def discord_event(request: DiscordEventRequest) -> dict:
    if request.channel_id not in settings.allowed_channel_ids:
        raise HTTPException(status_code=403, detail="Channel is not allowlisted.")
    if request.is_bot:
        return {"accepted": False, "reason": "Bot messages are not used as role evidence."}
    result = ingest_discord_event(store, request.model_dump())
    return {**result, "channel_id": request.channel_id, "persisted": True}


@app.post("/api/projects")
def create_project(request: DiscordProjectRequest) -> dict:
    if request.channel_id not in settings.allowed_channel_ids:
        raise HTTPException(status_code=403, detail="Channel is not allowlisted.")
    try:
        project = create_discord_project(store, request.model_dump())
        return {"project": project}
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/analyze")
def analyze() -> dict:
    try:
        return analyze_and_store_role_plan(store)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/role-plan")
def role_plan() -> dict:
    if store.role_plan is None:
        raise HTTPException(status_code=404, detail="No role plan has been generated.")
    return store.role_plan


@app.get("/api/discord/events/{channel_id}")
def discord_events(channel_id: str) -> dict:
    if channel_id not in settings.allowed_channel_ids:
        raise HTTPException(status_code=403, detail="Channel is not allowlisted.")
    events = [item for item in store.discord_events if item["channel_id"] == channel_id]
    classifications = [item for item in store.classifications if item.get("message_id") in {event["message_id"] for event in events}]
    return {"channel_id": channel_id, "events": events, "classifications": classifications}


@app.get("/api/progress/{project_id}")
def progress(project_id: str) -> dict:
    if store.project is None or project_id != store.project["id"]:
        raise HTTPException(status_code=404, detail="Project not found.")
    return {"project_id": project_id, "progress": store.snapshot()["progress"]}


@app.get("/api/files/{project_id}")
def files(project_id: str) -> dict:
    if store.project is None or project_id != store.project["id"]:
        raise HTTPException(status_code=404, detail="Project not found.")
    return {"project_id": project_id, "artifacts": store.snapshot()["artifacts"]}


@app.post("/api/goal-referee/results", dependencies=[Depends(require_ingest_token)])
def publish_goal_referee_result(request: GoalRefereeResultRequest) -> dict:
    payload = request.model_dump()
    goal_referee_results.put(request.channelId, payload)
    return {
        "accepted": True,
        "channelId": request.channelId,
        "generatedAt": request.generatedAt,
    }


@app.get("/api/goal-referee/results/latest")
def latest_goal_referee_result(
    channel_id: str | None = Query(default=None, max_length=100),
) -> dict:
    result = goal_referee_results.latest(channel_id)
    if result is None:
        raise HTTPException(status_code=404, detail="No Goal Referee result has been published.")
    return result
