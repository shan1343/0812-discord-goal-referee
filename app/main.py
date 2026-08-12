from datetime import datetime, timezone
from hmac import compare_digest
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.config import goal_referee_results, settings
from app.services import DEMO_PROJECT_ID, apply_constraint, confirm_assignment, propose_assignments, seed_demo
from app.store import store


app = FastAPI(title="Discord Goal Referee", version="0.2.0")
STATIC_DIR = Path(__file__).parent / "static"

if settings.dashboard_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.dashboard_cors_origins),
        allow_methods=["GET"],
        allow_headers=["*"],
    )


class ConfirmRequest(BaseModel):
    assignment_id: str
    actor: str = Field(min_length=1, max_length=80)


class ConstraintRequest(BaseModel):
    assignment_id: str
    constraint: str = Field(min_length=1, max_length=300)


class DiscordEventRequest(BaseModel):
    channel_id: str
    author_id: str
    content: str = Field(max_length=4000)


class GoalRefereeTask(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    ownerId: str | None = Field(default=None, max_length=80)
    ownerName: str | None = Field(default=None, max_length=120)
    reason: str = Field(min_length=1, max_length=1200)
    evidenceMessageIds: list[str] = Field(default_factory=list, max_length=12)
    status: str = Field(pattern="^(proposed|needs_input)$")


class GoalRefereeResultRequest(BaseModel):
    guildId: str = Field(min_length=1, max_length=80)
    channelId: str = Field(min_length=1, max_length=80)
    generatedAt: datetime
    summary: str = Field(min_length=1, max_length=2000)
    tasks: list[GoalRefereeTask] = Field(min_length=1, max_length=12)
    questions: list[str] = Field(default_factory=list, max_length=8)


def dashboard_result(payload: dict) -> dict:
    """Do not expose Discord IDs or the shared ingest credential to the browser."""
    return {
        "generatedAt": payload["generatedAt"],
        "summary": payload["summary"],
        "tasks": [
            {
                "title": task["title"],
                "ownerName": task.get("ownerName"),
                "reason": task["reason"],
                "evidenceMessageIds": task["evidenceMessageIds"],
                "status": task["status"],
            }
            for task in payload["tasks"]
        ],
        "questions": payload["questions"],
    }


@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "bot": "dashboard_bridge_ready",
        "model": "fixture_fallback",
        "database": "file",
        "environment": settings.app_env,
    }


@app.post("/api/demo/seed")
def demo_seed() -> dict:
    return seed_demo(store)


@app.post("/api/assign")
def assign() -> dict:
    try:
        return {"project_id": DEMO_PROJECT_ID, "assignments": propose_assignments(store)}
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
    return {"accepted": True, "channel_id": request.channel_id, "persisted": False}


@app.post("/api/goal-referee/results", status_code=202)
def publish_goal_referee_result(
    request: GoalRefereeResultRequest,
    x_goal_referee_token: str | None = Header(default=None),
) -> dict:
    if not settings.goal_referee_ingest_token:
        raise HTTPException(status_code=503, detail="Goal Referee ingest is not configured.")
    if not x_goal_referee_token or not compare_digest(
        x_goal_referee_token, settings.goal_referee_ingest_token
    ):
        raise HTTPException(status_code=401, detail="Invalid Goal Referee ingest token.")
    if request.channelId not in settings.allowed_channel_ids:
        raise HTTPException(status_code=403, detail="Channel is not allowlisted.")

    payload = request.model_dump(mode="json")
    payload["generatedAt"] = payload.get("generatedAt") or datetime.now(timezone.utc).isoformat()
    goal_referee_results.put(request.channelId, payload)
    return {"accepted": True, "channel_id": request.channelId}


@app.get("/api/goal-referee/latest")
def latest_goal_referee_result(channel_id: str | None = None) -> dict:
    result = goal_referee_results.latest(channel_id)
    if not result:
        raise HTTPException(status_code=404, detail="No Goal Referee result has been published yet.")
    return dashboard_result(result)


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
