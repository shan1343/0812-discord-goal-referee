from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.services import DEMO_PROJECT_ID, apply_constraint, confirm_assignment, propose_assignments, seed_demo
from app.store import store


app = FastAPI(title="Discord Goal Referee", version="0.1.0")
STATIC_DIR = Path(__file__).parent / "static"


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


@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "bot": "not_connected",
        "model": "fixture_fallback",
        "database": "memory",
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
    # Raw messages are not persisted in this first slice. Discord signature and
    # interaction verification will be added with the real bot adapter.
    return {"accepted": True, "channel_id": request.channel_id, "persisted": False}


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
