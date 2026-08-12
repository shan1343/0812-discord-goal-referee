from fastapi.testclient import TestClient

from app.main import app
from app.store import store


client = TestClient(app)


def setup_function() -> None:
    store.reset()


def test_health_does_not_expose_secrets() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "token" not in str(body).lower()
    assert "api_key" not in str(body).lower()


def test_closed_demo_path_requires_human_confirmation() -> None:
    assert client.post("/api/demo/seed").status_code == 200
    assignments = client.post("/api/assign").json()["assignments"]
    assert any(item["owner"] is None and item["status"] == "needs_input" for item in assignments)

    before = client.get("/api/progress/demo-project").json()["progress"]
    bot_before = next(item for item in before if item["task_id"] == "task-bot")
    assert bot_before["percent"] < 100

    confirmed = client.post("/api/confirm", json={"assignment_id": "assignment-a", "actor": "tester"})
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmed"

    after = client.get("/api/progress/demo-project").json()["progress"]
    bot_after = next(item for item in after if item["task_id"] == "task-bot")
    assert bot_after["state"] == "review_pending"
    assert bot_after["percent"] == 90


def test_evidence_free_assignment_cannot_be_confirmed() -> None:
    client.post("/api/demo/seed")
    client.post("/api/assign")
    response = client.post("/api/confirm", json={"assignment_id": "assignment-unknown", "actor": "tester"})
    assert response.status_code == 409


def test_assign_requires_seed_and_unknown_project_is_hidden() -> None:
    assert client.post("/api/assign").status_code == 409
    assert client.get("/api/files/not-allowed").status_code == 404


def test_confirmed_assignment_survives_reanalysis() -> None:
    client.post("/api/demo/seed")
    client.post("/api/assign")
    client.post("/api/confirm", json={"assignment_id": "assignment-a", "actor": "tester"})
    assignments = client.post("/api/assign").json()["assignments"]
    confirmed = next(item for item in assignments if item["id"] == "assignment-a")
    assert confirmed["status"] == "confirmed"


def test_new_constraint_requires_human_reconfirmation() -> None:
    client.post("/api/demo/seed")
    client.post("/api/assign")
    client.post("/api/confirm", json={"assignment_id": "assignment-a", "actor": "tester"})
    response = client.post(
        "/api/reassign",
        json={"assignment_id": "assignment-a", "constraint": "13:00 이후 작업 불가"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "proposed"
    assert "13:00 이후 작업 불가" in response.json()["blockers"]


def test_discord_channel_allowlist() -> None:
    allowed = client.post(
        "/api/discord/events",
        json={"channel_id": "project-room", "author_id": "user-1", "content": "hello"},
    )
    denied = client.post(
        "/api/discord/events",
        json={"channel_id": "private-room", "author_id": "user-1", "content": "secret"},
    )
    assert allowed.status_code == 200
    assert allowed.json()["persisted"] is False
    assert denied.status_code == 403
